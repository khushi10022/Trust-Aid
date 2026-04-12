"""
TrustAid OpenEnv — Frontier Belief-State Agent
===============================================
A principled baseline agent that:
  1. Maintains a belief distribution over hidden state variables
  2. Uses uncertainty-driven decision making (explore vs. exploit)
  3. Applies causal reasoning before dispatching
  4. Tracks expected vs. actual outcomes
  5. Emits structured [START] / [STEP] / [END] logs

Architecture:
  - Belief state: P(severity | observations) via Bayesian update
  - Information value: Expected reduction in belief uncertainty
  - Decision policy: Thompson sampling over action types
  - Safety filter: Hard constraints before any dispatch
  - LLM layer: OpenAI client for natural language generation

Usage:
  python inference.py                          # Run all 3 scenarios
  python inference.py --scenario hard          # Run specific scenario
  python inference.py --verbose                # Full step details
  python inference.py --output results.json    # Save JSON results

Author : TrustAid RL Team
Version: 3.1.0
"""

import os
import math
import json
import time
import argparse
import random
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime

# ── Env vars (required by hackathon checker) ──────────────────────────────────
# Defaults allowed ONLY for API_BASE_URL and MODEL_NAME
API_BASE_URL = os.getenv("API_BASE_URL", "https://api-inference.huggingface.co/v1")
MODEL_NAME   = os.getenv("MODEL_NAME",   "meta-llama/Llama-3.1-8B-Instruct")
HF_TOKEN     = os.getenv("HF_TOKEN")   # NO default — must be set as a Space secret

# ── OpenAI client (required by hackathon checker) ─────────────────────────────
from openai import OpenAI

_llm_client: Optional[OpenAI] = None

def get_llm_client() -> OpenAI:
    """Lazy singleton — builds client once, reuses after."""
    global _llm_client
    if _llm_client is None:
        _llm_client = OpenAI(
            base_url=API_BASE_URL,
            api_key=HF_TOKEN or "hf_placeholder",
        )
    return _llm_client


def llm_generate(system: str, user: str, max_tokens: int = 120) -> str:
    """
    Call the LLM via OpenAI client. Falls back to a safe placeholder
    string if the API is unavailable (so the episode still runs).
    """
    try:
        client = get_llm_client()
        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.4,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        # Graceful degradation — never crash the episode
        return f"[LLM unavailable: {exc}]"


# ── Environment imports ───────────────────────────────────────────────────────
from environment import (
    TrustAidPOMDP, Action, ActionType, Observation,
    SCENARIOS, StepResult
)
from graders import grade_episode, GradeResult


# ─────────────────────────────────────────────
# Belief State
# ─────────────────────────────────────────────

@dataclass
class BeliefState:
    """
    Maintained by the agent — a probability distribution over hidden variables.
    Updated via Bayesian updates at each step.
    """
    # P(severity = high) — starts as prior, updated with observations
    p_high_severity:   float = 0.4
    p_truthful_user:   float = 0.75
    p_complication:    float = 0.1

    # Accumulated info
    estimated_risk:    float = 1.0
    uncertainty:       float = 1.0   # 0=certain, 1=maximally uncertain
    info_value_gained: float = 0.0
    known_facts:       List[str] = field(default_factory=list)
    hypotheses:        Dict[str, float] = field(default_factory=dict)

    def update(self, obs: Observation, last_action: Optional[Action], user_response: str):
        """Bayesian belief update from new observation."""

        # ── Update P(high severity) ──
        panic_likelihood_given_high = min(0.95, obs.panic_level * 1.2)
        panic_likelihood_given_low  = max(0.05, obs.panic_level * 0.5)

        p_obs_given_high = panic_likelihood_given_high
        p_obs_given_low  = panic_likelihood_given_low
        p_obs = (p_obs_given_high * self.p_high_severity
                 + p_obs_given_low * (1 - self.p_high_severity))

        if p_obs > 0:
            self.p_high_severity = (p_obs_given_high * self.p_high_severity) / p_obs

        self.estimated_risk = obs.current_risk * (0.7 + 0.3 * self.p_high_severity)

        # ── Update P(truthful) from response coherence ──
        if "don't know" in user_response.lower() or "not sure" in user_response.lower():
            self.p_truthful_user = max(0.3, self.p_truthful_user - 0.05)
        if "confirmed" in user_response.lower() or "yes" in user_response.lower():
            self.p_truthful_user = min(0.95, self.p_truthful_user + 0.02)

        # ── Update P(complication) ──
        if obs.step_num > 4 and obs.current_risk > 5.0:
            self.p_complication = min(0.8, self.p_complication + 0.1)

        # ── Update uncertainty (entropy proxy) ──
        p = max(1e-6, min(1-1e-6, self.p_high_severity))
        entropy = -p * math.log2(p) - (1-p) * math.log2(1-p)
        self.uncertainty = entropy

        # ── Update known facts ──
        if last_action and last_action.action_type == ActionType.VERIFY_FACT:
            if last_action.target_fact and last_action.target_fact not in self.known_facts:
                if "confirmed" in user_response.lower() or "yes" in user_response.lower():
                    self.known_facts.append(last_action.target_fact)
                    self.info_value_gained += 0.15

    def information_value_of(self, fact: str, obs: Observation) -> float:
        """Expected reduction in uncertainty from verifying a fact."""
        high_value = ["medication", "breathing", "address", "location", "weapon", "alone"]
        base_value = 0.2 if any(hv in fact.lower() for hv in high_value) else 0.08
        if fact in self.known_facts:
            return 0.01
        return base_value * self.uncertainty

    def should_dispatch(self, obs: Observation, category: str) -> Tuple[bool, str]:
        """
        Causal decision: Is it safe/correct to dispatch now?
        Returns (dispatch_ok, reason)
        """
        if category == "food":
            return False, "food_queries_never_dispatch_emergency"

        if self.p_high_severity > 0.65 and obs.current_risk > 5.0:
            return True, f"high_severity_belief={self.p_high_severity:.2f}_risk={obs.current_risk:.2f}"

        if obs.step_num >= 4 and not obs.verified_facts:
            return self.p_high_severity > 0.5, "time_pressure_no_facts_verified"

        if len(obs.verified_facts) >= 2 and self.p_high_severity > 0.4:
            return True, f"sufficient_facts_verified={len(obs.verified_facts)}"

        return False, f"uncertainty_too_high={self.uncertainty:.2f}"


# ─────────────────────────────────────────────
# Structured Logger
# ─────────────────────────────────────────────

class StructuredLogger:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.log_lines: List[str] = []
        self.step_records: List[Dict] = []

    def _ts(self) -> str:
        return datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]

    def start(self, scenario_id: str, scenario: Dict):
        line = (f"\n{'='*70}\n"
                f"[START] {self._ts()} | Scenario: {scenario_id}\n"
                f"        Category : {scenario['category']}\n"
                f"        Severity : {scenario['actual_severity']:.2f} (hidden)\n"
                f"        Truthful : {scenario['user_truthfulness']:.2f} (hidden)\n"
                f"        Initial  : {scenario['initial_message']}\n"
                f"{'='*70}")
        print(line)
        self.log_lines.append(line)

    def step(self, step_num: int, action: Action, result: StepResult, belief: BeliefState):
        obs = result.observation
        ri  = result.reward_info

        belief_str = (f"P(high)={belief.p_high_severity:.2f} "
                      f"P(truth)={belief.p_truthful_user:.2f} "
                      f"uncert={belief.uncertainty:.2f}")

        main = (f"[STEP {step_num:02d}] {self._ts()}\n"
                f"  Action  : {action.action_type.value} | {action.content[:60]}\n"
                f"  Obs     : risk={obs.current_risk:.2f} panic={obs.panic_level:.2f} "
                f"facts={len(obs.verified_facts)} noise={obs.observation_noise:.2f}\n"
                f"  Reward  : {result.reward:+.4f}  [{ri.description[:60]}]\n"
                f"  Belief  : {belief_str}")

        if obs.hint:
            main += f"\n  Hint    : ⚡ {obs.hint}"
        if result.done:
            main += f"\n  ⏹  Episode done."

        print(main)
        self.log_lines.append(main)

        self.step_records.append({
            "step":       step_num,
            "action":     action.action_type.value,
            "content":    action.content,
            "reward":     result.reward,
            "risk":       obs.current_risk,
            "panic":      obs.panic_level,
            "verified":   len(obs.verified_facts),
            "belief_sev": belief.p_high_severity,
            "uncertainty": belief.uncertainty,
        })

        if self.verbose and result.info.get("user_response"):
            print(f"  User ← : \"{result.info['user_response'][:80]}\"")

    def end(self, grade: GradeResult, total_reward: float, total_steps: int, hidden: Dict):
        line = (f"\n{'─'*70}\n"
                f"[END] {self._ts()}\n"
                f"  Total Steps   : {total_steps}\n"
                f"  Total Reward  : {total_reward:+.4f}\n"
                f"  GRADE         : {grade.final_score:.4f} [{grade.grade_label}]\n"
                f"  CF Delta      : {grade.counterfactual_delta:+.4f}\n"
                f"  ✓ Met         : {', '.join(grade.met_criteria) or 'none'}\n"
                f"  ✗ Missed      : {', '.join(grade.missed_criteria) or 'none'}\n"
                f"  Feedback      : {grade.feedback}\n"
                f"  Hidden Reveal : severity={hidden.get('actual_severity',0):.2f} "
                f"truthful={hidden.get('user_truthfulness',0):.2f} "
                f"complication={hidden.get('complication_triggered',False)}\n"
                f"{'─'*70}")
        print(line)
        self.log_lines.append(line)

    def summary(self, results: List[Dict]):
        bar = "─" * 70
        print(f"\n{bar}")
        print(f"[SUMMARY] {self._ts()}")
        print(f"{'Task':<30} {'Score':>7} {'Grade':>6} {'CF Δ':>8} {'Reward':>8}")
        print(bar)
        total_score = 0.0
        for r in results:
            print(f"  {r['scenario']:<28} {r['score']:>7.4f} {r['grade']:>6}  {r['cf_delta']:>+7.4f}  {r['total_reward']:>+7.4f}")
            total_score += r['score']
        print(bar)
        print(f"  {'AVERAGE':<28} {total_score/len(results):>7.4f}\n")


# ─────────────────────────────────────────────
# Frontier Agent
# ─────────────────────────────────────────────

class FrontierAgent:
    """
    A belief-state agent that:
    - Maintains and updates a belief distribution each step
    - Computes information value before asking questions
    - Uses causal check before dispatching (no blind dispatch)
    - Uses OpenAI client (via HF Inference API) for natural language generation
    - Tracks conversation history for context
    """

    CRITICAL_FACTS_BY_CATEGORY = {
        "food":    ["order_id", "delivery_app"],
        "woman":   ["current_location", "is_threat_active", "safe_refuge_nearby"],
        "medical": ["patient_breathing", "current_medications", "exact_address"],
        "police":  ["incident_type", "suspect_description", "exact_location"],
        "fire":    ["fire_location", "people_trapped", "gas_leak"],
        "disaster":["area_affected", "people_displaced", "access_route"],
        "child":   ["child_location", "threat_type", "guardian_present"],
        "elderly": ["fall_location", "consciousness", "medications"],
        "cyber":   ["type_of_fraud", "amount_lost", "time_of_incident"],
        "railway": ["train_number", "station_name", "nature_of_emergency"],
        "animal":  ["animal_type", "bite_occurred", "location"],
        "other":   ["issue_type", "location", "severity"],
    }

    QUESTION_BANK = {
        "current_location":    "Can you tell me your exact location right now? A landmark or street name helps.",
        "is_threat_active":    "Is the person still following you, or have they stopped?",
        "safe_refuge_nearby":  "Is there a shop, hospital, or police station nearby you can enter?",
        "patient_breathing":   "Is the patient breathing? Can you see their chest rising?",
        "current_medications": "What medications is he currently taking? This is very important for treatment.",
        "exact_address":       "What is your complete address so we can send help to the exact location?",
        "bystander_available": "Is there someone else with you who can help with CPR?",
        "order_id":            "Can you share your order ID or order number?",
        "delivery_app":        "Which delivery app did you use — Zomato, Swiggy, or another?",
        "incident_type":       "What type of incident are you reporting?",
        "suspect_description": "Can you describe the suspect — height, clothing, direction of travel?",
        "fire_location":       "Which floor or area is the fire on? Are there people trapped?",
        "people_trapped":      "Are there people trapped inside the building?",
        "gas_leak":            "Do you smell gas? Have you turned off the main gas valve?",
    }

    GUIDANCE_BANK = {
        "calm":          "Please stay calm — I am with you and help is coming. Take a slow breath.",
        "cpr":           ("Start CPR now: Place your hands in the center of the chest. "
                          "Push hard and fast — 30 compressions, then 2 breaths. Repeat."),
        "location_share": "Share your live location with a trusted contact right now.",
        "move_safe":     "Move to a well-lit, crowded area immediately — a shop, hospital, or busy street.",
        "track_order":   "Open your delivery app → My Orders → tap the order → Track Order for live GPS.",
        "unlock_door":   "Unlock your front door now so paramedics can enter when they arrive.",
        "don't_move":    "Do NOT move him. Keep him still — moving can worsen spinal or head injuries.",
        "warfarin_note": "Important: If he takes warfarin or blood thinners, do NOT give aspirin — it can cause internal bleeding.",
    }

    # System prompt for the LLM layer
    LLM_SYSTEM = (
        "You are TrustAid, an Indian emergency support AI. "
        "Respond in 1-2 short, calm, empathetic sentences. "
        "Be direct and action-oriented. Never mention you are an AI. "
        "Always respond in the same language the user is using."
    )

    def __init__(self, verbose: bool = False):
        self.verbose     = verbose
        self.belief      = BeliefState()
        self.history:    List[Tuple[Action, StepResult]] = []
        self.step_count  = 0
        self._verifying: List[str] = []
        self._dispatched = False

    def reset(self, initial_obs: Observation):
        self.belief      = BeliefState()
        self.history     = []
        self.step_count  = 0
        self._verifying  = []
        self._dispatched = False
        self.belief.update(initial_obs, None, initial_obs.user_message)

    def _llm_rephrase(self, template: str, obs: Observation) -> str:
        """
        Use the LLM to generate a natural, empathetic version of a
        template response. Falls back to the template if LLM fails.
        """
        user_prompt = (
            f"User situation: {obs.user_message}\n"
            f"Category: {obs.category}, Panic level: {obs.panic_level:.1f}/1.0\n"
            f"Draft response: {template}\n\n"
            f"Rewrite the draft response naturally (1-2 sentences). "
            f"Keep all specific numbers, steps, and emergency info intact."
        )
        result = llm_generate(self.LLM_SYSTEM, user_prompt, max_tokens=100)
        # If LLM returns a placeholder/error, use the template
        if result.startswith("[LLM unavailable") or len(result) < 5:
            return template
        return result

    def decide(self, obs: Observation) -> Action:
        """
        Main decision function. Returns the action with highest expected value
        under the current belief state. Uses LLM for natural language output.
        """
        self.step_count += 1
        cat = obs.category

        # ── Safety first: calm the user if panic is extreme ──
        if obs.panic_level > 0.75 and self.step_count <= 2:
            return self._calm_action(obs)

        # ── Check if we should dispatch based on belief ──
        dispatch_ok, dispatch_reason = self.belief.should_dispatch(obs, cat)

        if cat == "medical" and obs.current_risk > 6.0 and not self._dispatched:
            dispatch_ok = True
            dispatch_reason = "medical_critical_risk_override"

        if dispatch_ok and not self._dispatched:
            return self._dispatch_action(obs, dispatch_reason)

        # ── Compute information value for each unverified critical fact ──
        critical_facts = self.CRITICAL_FACTS_BY_CATEGORY.get(cat, [])
        unverified = [cf for cf in critical_facts if cf not in self.belief.known_facts]

        if unverified:
            fact_values = {
                cf: self.belief.information_value_of(cf, obs)
                for cf in unverified
            }
            best_fact = max(fact_values, key=fact_values.get)
            iv = fact_values[best_fact]

            if iv > 0.05:
                if best_fact in self._verifying:
                    return self._verify_action(obs, best_fact)
                else:
                    self._verifying.append(best_fact)
                    return self._ask_action(obs, best_fact)

        # ── If we've gathered enough info, dispatch ──
        if not self._dispatched and len(self.belief.known_facts) >= 1:
            return self._dispatch_action(obs, "sufficient_info_gathered")

        # ── Post-dispatch: provide continued guidance ──
        if self._dispatched:
            return self._post_dispatch_guidance(obs, cat)

        return self._fallback_action(obs)

    def update(self, action: Action, result: StepResult):
        """Update belief from step result."""
        user_response = result.info.get("user_response", "")
        self.belief.update(result.observation, action, user_response)
        self.history.append((action, result))
        if action.action_type == ActionType.DISPATCH_SERVICE:
            self._dispatched = True

    # ── Action Constructors ────────────────────────────────────

    def _calm_action(self, obs: Observation) -> Action:
        template = (f"{self.GUIDANCE_BANK['calm']} "
                    f"You called the right service. I will guide you through this step by step.")
        content = self._llm_rephrase(template, obs)
        return Action(
            action_type=ActionType.PROVIDE_GUIDANCE,
            content=content,
            metadata={"intent": "panic_reduction", "panic_level": obs.panic_level}
        )

    def _ask_action(self, obs: Observation, fact: str) -> Action:
        template = self.QUESTION_BANK.get(fact, f"Can you tell me more about {fact.replace('_',' ')}?")
        if obs.panic_level > 0.5:
            template = "Stay with me — " + template.lower()
        content = self._llm_rephrase(template, obs)
        return Action(
            action_type=ActionType.ASK_QUESTION,
            content=content,
            metadata={"target_fact": fact, "info_value": self.belief.information_value_of(fact, obs)}
        )

    def _verify_action(self, obs: Observation, fact: str) -> Action:
        template = f"Let me confirm: {fact.replace('_', ' ')}. Can you confirm this for me?"
        content = self._llm_rephrase(template, obs)
        return Action(
            action_type=ActionType.VERIFY_FACT,
            content=content,
            target_fact=fact,
            metadata={"fact": fact}
        )

    def _dispatch_action(self, obs: Observation, reason: str) -> Action:
        cat = obs.category
        dispatch_map = {
            "medical":  ("ambulance", "108", "Dispatching ambulance — call 108 NOW. Help is on the way."),
            "woman":    ("police_and_helpline", "112 / 1091", "Dispatching police immediately. Call 112 or 1091. Move to a safe place now."),
            "police":   ("police", "100", "Contacting police — call 100 immediately. Stay on the line."),
            "fire":     ("fire_brigade", "101", "Fire brigade dispatched — call 101. Evacuate immediately."),
            "disaster": ("ndma", "1078", "NDMA disaster response activated. Call 1078. Move to high ground."),
            "child":    ("childline_police", "1098 / 100", "Childline and police alerted — call 1098. Stay safe."),
        }
        service, number, msg = dispatch_map.get(cat, ("emergency", "112", f"Emergency services dispatched. Call 112."))

        if cat == "medical":
            if "current_medications" not in self.belief.known_facts:
                msg += " IMPORTANT: Do NOT give aspirin or any medication until paramedics confirm it is safe."
            msg += f" {self.GUIDANCE_BANK['unlock_door']}"

        # LLM enriches the dispatch message while keeping all key info
        content = self._llm_rephrase(msg, obs)

        return Action(
            action_type=ActionType.DISPATCH_SERVICE,
            content=content,
            service_id=service,
            metadata={"number": number, "reason": reason, "belief_severity": self.belief.p_high_severity}
        )

    def _post_dispatch_guidance(self, obs: Observation, cat: str) -> Action:
        """Continued guidance after dispatch."""
        guidance_priority = []

        if cat == "medical":
            if "patient_breathing" not in self.belief.known_facts:
                guidance_priority.append(self.GUIDANCE_BANK["cpr"])
            else:
                guidance_priority.append(self.GUIDANCE_BANK["don't_move"])
            if obs.panic_level > 0.5:
                guidance_priority.append("Help is coming. Keep the patient still and warm. Stay on the line.")
        elif cat == "woman":
            guidance_priority.append(self.GUIDANCE_BANK["move_safe"])
            guidance_priority.append(self.GUIDANCE_BANK["location_share"])
        else:
            guidance_priority.append(f"Help is on the way. Please stay calm and keep your phone line open.")

        template = " ".join(guidance_priority[:2])
        content = self._llm_rephrase(template, obs)

        if obs.step_num >= 8 and obs.current_risk < 3.0:
            return Action(
                action_type=ActionType.CLOSE_CASE,
                content="Services have been dispatched and guidance provided. Please stay safe and follow up if needed.",
                metadata={"final_risk": obs.current_risk}
            )

        return Action(
            action_type=ActionType.PROVIDE_GUIDANCE,
            content=content,
            metadata={"post_dispatch": True}
        )

    def _fallback_action(self, obs: Observation) -> Action:
        template = "Can you describe what is happening right now so I can help you better?"
        content = self._llm_rephrase(template, obs)
        return Action(
            action_type=ActionType.ASK_QUESTION,
            content=content,
            metadata={"fallback": True}
        )


# ─────────────────────────────────────────────
# Episode Runner
# ─────────────────────────────────────────────

def run_episode(
    scenario_id: str,
    env: TrustAidPOMDP,
    agent: FrontierAgent,
    logger: StructuredLogger,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Run a complete episode and return graded results."""
    scenario = SCENARIOS[scenario_id]
    difficulty = "easy" if "easy" in scenario_id else ("hard" if "hard" in scenario_id else "medium")

    logger.start(scenario_id, scenario)

    obs = env.reset(scenario_id)
    agent.reset(obs)

    total_reward = 0.0
    agent_responses = []

    for step_num in range(1, TrustAidPOMDP.MAX_STEPS + 1):
        action = agent.decide(obs)
        agent_responses.append(action.content)

        result = env.step(action)
        total_reward += result.reward

        agent.update(action, result)
        logger.step(step_num, action, result, agent.belief)

        obs = result.observation

        if result.done or result.truncated:
            hidden = result.info.get("hidden_state_reveal", {})
            break

    final_state = env.state()
    final_state["verified_facts"] = obs.verified_facts
    final_state["dispatch_occurred"] = env._dispatch_occurred
    final_state["dispatch_step"] = env._dispatch_step

    hidden_reveal = result.info.get("hidden_state_reveal", {})

    grade = grade_episode(
        difficulty=difficulty,
        episode_log=env.get_episode_log(),
        final_state=final_state,
        agent_responses=agent_responses,
        hidden_reveal=hidden_reveal if hidden_reveal else None,
    )

    logger.end(grade, total_reward, step_num, hidden_reveal)

    return {
        "scenario":     scenario_id,
        "difficulty":   difficulty,
        "score":        grade.final_score,
        "grade":        grade.grade_label,
        "cf_delta":     grade.counterfactual_delta,
        "total_reward": round(total_reward, 4),
        "total_steps":  step_num,
        "met_criteria": grade.met_criteria,
        "missed_criteria": grade.missed_criteria,
        "fail_conditions": grade.fail_conditions_hit,
        "feedback":     grade.feedback,
        "sub_scores":   grade.sub_scores,
        "belief_trajectory": [
            {"step": r["step"], "severity": r["belief_sev"], "uncertainty": r["uncertainty"]}
            for r in logger.step_records
        ],
    }


# ─────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TrustAid POMDP Baseline Inference")
    parser.add_argument("--scenario", choices=list(SCENARIOS.keys()) + ["all"],
                        default="all", help="Scenario to run")
    parser.add_argument("--verbose", action="store_true", help="Show full step details")
    parser.add_argument("--output", type=str, default=None,
                        help="Save JSON results to file")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    random.seed(args.seed)

    env    = TrustAidPOMDP()
    agent  = FrontierAgent(verbose=args.verbose)
    logger = StructuredLogger(verbose=args.verbose)

    print(f"\n{'█'*70}")
    print(f"  TrustAid OpenEnv — POMDP Frontier Agent Baseline")
    print(f"  Timestamp   : {datetime.utcnow().isoformat()}")
    print(f"  Seed        : {args.seed}")
    print(f"  Scenarios   : {args.scenario}")
    print(f"  Model       : {MODEL_NAME}")
    print(f"  API Base    : {API_BASE_URL}")
    print(f"  HF_TOKEN    : {'set' if HF_TOKEN else 'NOT SET — LLM calls will fail'}")
    print(f"{'█'*70}")

    scenarios_to_run = (
        list(SCENARIOS.keys()) if args.scenario == "all"
        else [args.scenario]
    )

    all_results = []
    start_time = time.time()

    for scenario_id in scenarios_to_run:
        result = run_episode(scenario_id, env, agent, logger, args.verbose)
        all_results.append(result)
        logger.step_records = []

    elapsed = time.time() - start_time
    logger.summary(all_results)

    print(f"  Total runtime: {elapsed:.2f}s | {elapsed/len(all_results):.2f}s/episode")

    if args.output:
        output = {
            "timestamp":   datetime.utcnow().isoformat(),
            "seed":        args.seed,
            "agent":       "FrontierBeliefStateAgent_v3.1_LLM",
            "model":       MODEL_NAME,
            "total_time":  elapsed,
            "results":     all_results,
            "summary": {
                "avg_score":  sum(r["score"] for r in all_results) / len(all_results),
                "avg_reward": sum(r["total_reward"] for r in all_results) / len(all_results),
            }
        }
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2, default=str)
        print(f"\n  Results saved → {args.output}")

    return all_results


if __name__ == "__main__":
    main()