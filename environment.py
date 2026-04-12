"""
TrustAid OpenEnv — POMDP Environment
======================================
Full Partially-Observable Markov Decision Process for emergency customer support.

Hidden state is NEVER exposed through step(). Agents must infer latent variables
from noisy observations and choose between information-gathering vs. dispatching.

Author : TrustAid RL Team
Version: 3.0.0  (POMDP Upgrade)
"""

import math
import uuid
import random
import time
from enum import Enum
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field, validator


# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────

class ActionType(str, Enum):
    ASK_QUESTION      = "ask_question"       # Information gathering
    DISPATCH_SERVICE  = "dispatch_service"   # Call emergency service
    PROVIDE_GUIDANCE  = "provide_guidance"   # Give first-aid / calm user
    VERIFY_FACT       = "verify_fact"        # Confirm a specific claim
    ESCALATE          = "escalate"           # Elevate to higher authority
    CLOSE_CASE        = "close_case"         # Mark resolved


class Action(BaseModel):
    action_type:  ActionType
    content:      str                             = Field(..., description="Natural language action text")
    target_fact:  Optional[str]                   = Field(None, description="Fact to verify (for VERIFY_FACT)")
    service_id:   Optional[str]                   = Field(None, description="Service to dispatch (for DISPATCH_SERVICE)")
    metadata:     Dict[str, Any]                  = Field(default_factory=dict)

    @validator('content')
    def content_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Action content cannot be empty")
        return v.strip()


class Observation(BaseModel):
    """Agent-visible state — hidden variables are intentionally absent."""
    session_id:       str
    step_num:         int
    category:         str
    panic_level:      float   = Field(..., ge=0.0, le=1.0,  description="Observed user panic [0,1]")
    time_elapsed:     float   = Field(..., ge=0.0,           description="Seconds since episode start")
    current_risk:     float   = Field(..., ge=0.0, le=10.0, description="Observed risk score [0,10]")
    verified_facts:   List[str]                              # What the agent has confirmed
    user_message:     str                                    # Latest user utterance
    conversation_len: int
    available_actions: List[str]
    observation_noise: float  = Field(..., ge=0.0, le=1.0,  description="How noisy current obs is")
    hint:             Optional[str]  = None                 # Optional contextual hint


class RewardInfo(BaseModel):
    """Decomposed reward signal for interpretability."""
    total:              float
    info_gain:          float   = 0.0
    risk_reduction:     float   = 0.0
    efficiency_bonus:   float   = 0.0
    delay_penalty:      float   = 0.0
    premature_penalty:  float   = 0.0
    unsafe_penalty:     float   = 0.0
    completion_bonus:   float   = 0.0
    description:        str     = ""


class StepResult(BaseModel):
    observation:  Observation
    reward:       float
    reward_info:  RewardInfo
    done:         bool
    truncated:    bool          # Hit max steps without completion
    info:         Dict[str, Any]


# ─────────────────────────────────────────────
# Hidden State (never exposed to agent)
# ─────────────────────────────────────────────

class _HiddenState:
    """Internal POMDP latent variables — NOT accessible via step()."""

    def __init__(self, scenario: Dict[str, Any]):
        s = scenario

        # Core latent variables
        self.true_risk_rate:       float = s.get('true_risk_rate', 0.3)
        self.actual_severity:      float = s.get('actual_severity', 0.4)   # 0=minor, 1=life-threatening
        self.user_truthfulness:    float = s.get('user_truthfulness', 0.8)  # P(user tells truth)
        self.hidden_complications: List[str] = s.get('hidden_complications', [])
        self.hidden_spread_rate:   float = s.get('hidden_spread_rate', 0.05)
        self.base_risk:            float = s.get('base_risk', 1.0)
        self.critical_facts:       List[str] = s.get('critical_facts', [])
        self.optimal_dispatch_step: int  = s.get('optimal_dispatch_step', 3)
        self.instant_fail_conditions: List[str] = s.get('instant_fail_conditions', [])

        # Mutable during episode
        self.panic_drift:    float = 0.0   # Accumulates with bad agent actions
        self.complication_triggered: bool = False


class _ObservableState:
    """Agent-visible state, updated each step with controlled noise."""

    def __init__(self, scenario: Dict[str, Any]):
        self.panic_level:    float = scenario.get('initial_panic', 0.2)
        self.time_elapsed:   float = 0.0
        self.current_risk:   float = scenario.get('initial_risk', 1.0)
        self.verified_facts: List[str] = []
        self.conversation:   List[Dict] = []


# ─────────────────────────────────────────────
# Scenario Definitions
# ─────────────────────────────────────────────

SCENARIOS = {
    "easy_food_delay": {
        "category":          "food",
        "description":       "User calmly asks about a delayed food order.",
        "initial_panic":     0.15,
        "initial_risk":      0.5,
        "true_risk_rate":    0.05,
        "actual_severity":   0.1,
        "user_truthfulness": 0.95,
        "hidden_spread_rate": 0.02,
        "base_risk":         0.5,
        "hidden_complications": [],
        "critical_facts":    ["order_id", "delivery_app"],
        "optimal_dispatch_step": 2,
        "instant_fail_conditions": ["dispatch_emergency_services"],
        "user_persona": "Patient, truthful. Gives info directly.",
        "initial_message": "Hi, my food order is 45 minutes late. Can you help me track it?",
    },
    "medium_woman_safety": {
        "category":          "woman",
        "description":       "Emotionally distressed user feels followed at night.",
        "initial_panic":     0.55,
        "initial_risk":      3.5,
        "true_risk_rate":    0.4,
        "actual_severity":   0.65,
        "user_truthfulness": 0.7,     # Panic distorts her reports
        "hidden_spread_rate": 0.08,
        "base_risk":         3.5,
        "hidden_complications": ["stalker_has_weapon", "user_is_alone"],
        "critical_facts":    ["current_location", "is_being_followed_actively", "safe_refuge_nearby"],
        "optimal_dispatch_step": 4,
        "instant_fail_conditions": ["close_case_without_location", "ask_unnecessary_question_thrice"],
        "user_persona": "Frightened, may understate or overstate threat. Needs calm anchor.",
        "initial_message": "I think someone is following me home... I'm really scared right now.",
    },
    "hard_medical_emergency": {
        "category":          "medical",
        "description":       "Multi-condition elderly patient collapsed. Hidden: undetected internal bleed.",
        "initial_panic":     0.82,
        "initial_risk":      7.2,
        "true_risk_rate":    0.75,
        "actual_severity":   0.95,
        "user_truthfulness": 0.5,      # Panicked caller omits critical details
        "hidden_spread_rate": 0.18,    # Fast deterioration
        "base_risk":         7.2,
        "hidden_complications": [
            "internal_bleeding",
            "aspirin_contraindicated_due_to_anticoagulants",
            "second_person_also_injured"
        ],
        "critical_facts":    [
            "patient_breathing",
            "current_medications",
            "exact_address",
            "bystander_available_for_cpr"
        ],
        "optimal_dispatch_step": 2,    # Must dispatch 108 by step 2
        "instant_fail_conditions": [
            "give_aspirin_without_checking_medications",
            "delay_dispatch_beyond_step_4",
            "close_case_while_patient_critical"
        ],
        "user_persona": "Hysterical. Omits medication info. Provides inaccurate breathing report.",
        "initial_message": "My father collapsed! He's 68, diabetic, heart condition — lips turning blue, not responding!",
    }
}


# ─────────────────────────────────────────────
# POMDP Environment
# ─────────────────────────────────────────────

class TrustAidPOMDP:
    """
    Partially Observable Markov Decision Process for TrustAid emergency support.

    The agent CANNOT directly observe:
      - true_risk_rate
      - actual_severity
      - user_truthfulness
      - hidden_complications

    It must infer these from:
      - noisy panic_level
      - time-degraded current_risk
      - verified_facts (accumulated through VERIFY_FACT actions)
      - conversation context
    """

    MAX_STEPS = 20

    def __init__(self):
        self._hidden: Optional[_HiddenState]     = None
        self._obs:    Optional[_ObservableState] = None
        self._scenario: Optional[Dict]           = None
        self._session_id: str                    = ""
        self._step_num:   int                    = 0
        self._start_time: float                  = 0.0
        self._done:       bool                   = False
        self._dispatch_occurred: bool            = False
        self._dispatch_step:     int             = -1
        self._episode_log:       List[Dict]      = []
        self._cumulative_reward: float           = 0.0
        self._total_info_gain:   float           = 0.0

    # ── Public API ──────────────────────────────

    def reset(self, scenario_id: str = "medium_woman_safety") -> Observation:
        """Reset environment to a new episode."""
        if scenario_id not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_id}. Options: {list(SCENARIOS.keys())}")

        self._scenario    = SCENARIOS[scenario_id]
        self._hidden      = _HiddenState(self._scenario)
        self._obs         = _ObservableState(self._scenario)
        self._session_id  = f"sess_{uuid.uuid4().hex[:8]}"
        self._step_num    = 0
        self._start_time  = time.time()
        self._done        = False
        self._dispatch_occurred = False
        self._dispatch_step     = -1
        self._episode_log       = []
        self._cumulative_reward = 0.0
        self._total_info_gain   = 0.0

        # Inject first user message into conversation
        self._obs.conversation.append({
            "role": "user",
            "content": self._scenario["initial_message"]
        })

        return self._build_observation(self._scenario["initial_message"])

    def step(self, action: Action) -> StepResult:
        """
        Execute one step. Hidden state NEVER appears in the returned StepResult.
        """
        if self._done:
            raise RuntimeError("Episode is done. Call reset().")

        self._step_num += 1
        elapsed = time.time() - self._start_time

        # ── 1. Update hidden state dynamics ──────────────
        self._update_hidden_dynamics(elapsed)

        # ── 2. Generate user response (with truthfulness noise) ──
        user_response = self._generate_user_response(action)

        # ── 3. Update observable state ───────────────────
        self._update_observable_state(action, elapsed, user_response)

        # ── 4. Compute reward ─────────────────────────────
        reward_info = self._compute_reward(action, elapsed)
        self._cumulative_reward += reward_info.total

        # ── 5. Check termination ──────────────────────────
        done, truncated, termination_reason = self._check_termination(action)
        self._done = done or truncated

        # ── 6. Build observation (no hidden state) ────────
        obs = self._build_observation(user_response)

        # ── 7. Log step ───────────────────────────────────
        self._episode_log.append({
            "step":           self._step_num,
            "action_type":    action.action_type,
            "action_content": action.content[:80],
            "reward":         reward_info.total,
            "risk":           self._obs.current_risk,
            "panic":          self._obs.panic_level,
            "verified_facts": len(self._obs.verified_facts),
        })

        return StepResult(
            observation=obs,
            reward=reward_info.total,
            reward_info=reward_info,
            done=self._done,
            truncated=truncated,
            info={
                "step":              self._step_num,
                "total_reward":      self._cumulative_reward,
                "termination":       termination_reason,
                "verified_count":    len(self._obs.verified_facts),
                "dispatch_occurred": self._dispatch_occurred,
                "dispatch_step":     self._dispatch_step,
                "user_response":     user_response,
                # Hidden state revealed ONLY at episode end for post-hoc analysis
                **({"hidden_state_reveal": self._reveal_hidden()} if self._done else {}),
            }
        )

    def state(self) -> Dict[str, Any]:
        """Returns ONLY observable state."""
        if not self._obs:
            return {"status": "not_initialized"}
        return {
            "session_id":       self._session_id,
            "step_num":         self._step_num,
            "category":         self._scenario["category"] if self._scenario else None,
            "panic_level":      round(self._obs.panic_level, 3),
            "time_elapsed":     round(self._obs.time_elapsed, 1),
            "current_risk":     round(self._obs.current_risk, 3),
            "verified_facts":   self._obs.verified_facts,
            "conversation_len": len(self._obs.conversation),
            "done":             self._done,
            "cumulative_reward": round(self._cumulative_reward, 4),
            "dispatch_occurred": self._dispatch_occurred,
        }

    def get_episode_log(self) -> List[Dict]:
        return self._episode_log

    def get_optimal_action_sequence(self) -> List[str]:
        """Returns the theoretically optimal action sequence (for grader baseline)."""
        if not self._scenario:
            return []
        scen_id = next((k for k,v in SCENARIOS.items() if v == self._scenario), "unknown")
        if "easy" in scen_id:
            return ["ask_question:get_order_id", "verify_fact:delivery_app", "provide_guidance:track_in_app"]
        elif "medium" in scen_id:
            return [
                "provide_guidance:calm_user",
                "ask_question:current_location",
                "verify_fact:is_being_followed_actively",
                "dispatch_service:police_112",
                "provide_guidance:move_to_safe_location"
            ]
        else:
            return [
                "dispatch_service:ambulance_108",
                "ask_question:patient_breathing",
                "verify_fact:current_medications",
                "provide_guidance:cpr_instructions",
                "verify_fact:exact_address"
            ]

    # ── Internal Dynamics ────────────────────────

    def _update_hidden_dynamics(self, elapsed: float):
        h = self._hidden

        # Exponential risk escalation: current_risk = base_risk * exp(t * hidden_spread_rate)
        true_risk = h.base_risk * math.exp(elapsed * h.hidden_spread_rate)
        h.true_risk_rate = min(true_risk, 10.0)

        # Panic drift if agent is slow (each step without action adds drift)
        h.panic_drift += 0.03

        # Trigger hidden complication after step 5 on hard scenarios
        if self._step_num >= 5 and not h.complication_triggered and h.hidden_complications:
            h.complication_triggered = True

    def _generate_user_response(self, action: Action) -> str:
        """
        Stochastic user response. Truthfulness modulates accuracy.
        Panicked users over-report or under-report based on user_truthfulness.
        """
        h = self._hidden
        tells_truth = random.random() < h.user_truthfulness

        if action.action_type == ActionType.ASK_QUESTION:
            if "location" in action.content.lower():
                if tells_truth:
                    return "I'm near MG Road, outside the pharmacy, walking home."
                else:
                    return "I don't know... somewhere near the market I think."

            if "breathing" in action.content.lower() or "breath" in action.content.lower():
                if h.actual_severity > 0.7:
                    # High severity — user may understate in panic
                    return "I think he's breathing? Hard to tell... his lips are still blue."
                return "Yes, he seems to be breathing, very shallow."

            if "medication" in action.content.lower() or "medicine" in action.content.lower():
                if tells_truth:
                    return "He takes warfarin and metformin. Doctor prescribed them."
                else:
                    # Critical: omits warfarin (anticoagulant — aspirin would be dangerous)
                    return "He takes some diabetes medication, I think."

            if "order" in action.content.lower() or "id" in action.content.lower():
                return "Order #TZ8842, placed on Zomato, 47 minutes ago."

            # Generic question response
            panic_noise = self._obs.panic_level
            if panic_noise > 0.6:
                return "I don't know! Please help me, what do I do?!"
            return "Yes, I can try to answer. What do you need?"

        elif action.action_type == ActionType.VERIFY_FACT:
            if action.target_fact and tells_truth:
                return f"Yes, confirmed: {action.target_fact} — that is correct."
            return "I'm not sure about that exactly right now."

        elif action.action_type == ActionType.PROVIDE_GUIDANCE:
            if self._obs.panic_level > 0.7:
                return "OK I'm trying... please stay with me, I'm panicking!"
            return "OK, understood. I'll do that. What next?"

        elif action.action_type == ActionType.DISPATCH_SERVICE:
            return "OK please send help as fast as possible!"

        elif action.action_type == ActionType.ESCALATE:
            return "Please escalate this, it's urgent!"

        elif action.action_type == ActionType.CLOSE_CASE:
            return "Thank you."

        return "I understand."

    def _update_observable_state(self, action: Action, elapsed: float, user_resp: str):
        h = self._hidden
        obs = self._obs

        # Time update
        obs.time_elapsed = elapsed

        # ── Risk update (observable version with noise) ──
        true_risk = h.base_risk * math.exp(elapsed * h.hidden_spread_rate)
        noise = random.gauss(0, 0.15)   # Gaussian observation noise
        obs.current_risk = max(0.0, min(10.0, true_risk + noise))

        # ── Panic level update ──
        # Panic grows with time and panic_drift; PROVIDE_GUIDANCE reduces it
        panic_decay = -0.08 if action.action_type == ActionType.PROVIDE_GUIDANCE else 0.0
        panic_growth = 0.04 + h.panic_drift * 0.3
        obs.panic_level = max(0.0, min(1.0, obs.panic_level + panic_growth + panic_decay))

        # Sharp panic spike if agent asks insensitive question during crisis
        if (action.action_type == ActionType.ASK_QUESTION
                and obs.panic_level > 0.7
                and "unnecessary" not in action.content.lower()):
            if not any(kw in action.content.lower() for kw in ["location","breathing","medication","address"]):
                obs.panic_level = min(1.0, obs.panic_level + 0.12)

        # ── Fact verification ──
        if action.action_type == ActionType.VERIFY_FACT and action.target_fact:
            fact = action.target_fact.lower().strip()
            if fact not in [f.lower() for f in obs.verified_facts]:
                # Only verify if the fact is actually confirmable
                if any(kw in user_resp.lower() for kw in ["yes", "confirmed", "correct", "that's right"]):
                    obs.verified_facts.append(action.target_fact)

        # Track dispatch
        if action.action_type == ActionType.DISPATCH_SERVICE and not self._dispatch_occurred:
            self._dispatch_occurred = True
            self._dispatch_step = self._step_num

        # Append to conversation
        obs.conversation.append({"role": "assistant", "content": action.content})
        obs.conversation.append({"role": "user", "content": user_resp})

    def _compute_reward(self, action: Action, elapsed: float) -> RewardInfo:
        h = self._hidden
        obs = self._obs

        r = RewardInfo(total=0.0)

        # ── 1. Information gain reward ──
        if action.action_type == ActionType.VERIFY_FACT and action.target_fact:
            is_critical = any(cf in action.target_fact.lower()
                              for cf in h.critical_facts)
            gain = 0.25 if is_critical else 0.08
            # Diminishing returns — more facts already verified = less gain
            already_verified_ratio = len(obs.verified_facts) / max(len(h.critical_facts), 1)
            gain *= max(0.1, 1.0 - already_verified_ratio * 0.5)
            r.info_gain = gain

        # ── 2. Risk reduction (dispatch + guidance) ──
        if action.action_type == ActionType.DISPATCH_SERVICE:
            verified_ratio = len(obs.verified_facts) / max(len(h.critical_facts), 1)
            # Must verify critical facts before dispatching (except medical)
            if h.actual_severity > 0.8 and not self._dispatch_occurred:
                # Dispatching ambulance fast on critical = big reward
                step_bonus = max(0.0, (h.optimal_dispatch_step - self._step_num) * 0.1)
                r.risk_reduction = 0.4 + step_bonus
            else:
                r.risk_reduction = 0.2 * verified_ratio

        if action.action_type == ActionType.PROVIDE_GUIDANCE:
            # Calming panic reduces downstream risk
            r.risk_reduction = 0.05 * obs.panic_level

        # ── 3. Efficiency bonus ──
        if self._step_num <= h.optimal_dispatch_step and action.action_type == ActionType.DISPATCH_SERVICE:
            r.efficiency_bonus = 0.3 * (h.optimal_dispatch_step - self._step_num + 1) / h.optimal_dispatch_step

        # ── 4. Delay penalty (exponential) ──
        if action.action_type == ActionType.ASK_QUESTION:
            if h.actual_severity > 0.6 and self._step_num > h.optimal_dispatch_step + 2:
                delay_factor = math.exp((self._step_num - h.optimal_dispatch_step) * 0.3) - 1
                r.delay_penalty = -min(0.5, 0.05 * delay_factor)

        # ── 5. Premature dispatch penalty ──
        if action.action_type == ActionType.DISPATCH_SERVICE:
            unverified_critical = [cf for cf in h.critical_facts
                                   if cf not in [vf.lower() for vf in obs.verified_facts]]
            if len(unverified_critical) >= 2 and h.actual_severity < 0.8:
                r.premature_penalty = -0.3

        # ── 6. Unsafe action penalty ──
        if action.action_type == ActionType.CLOSE_CASE:
            if obs.current_risk > 3.0 or obs.panic_level > 0.5:
                r.unsafe_penalty = -0.6
                r.description = "UNSAFE: Closed case while risk/panic still high"

        # Check instant fail conditions
        for cond in h.instant_fail_conditions:
            if self._check_fail_condition(cond, action):
                r.unsafe_penalty = -1.0
                r.description = f"INSTANT FAIL: {cond}"
                self._done = True
                break

        # ── 7. Completion bonus ──
        if action.action_type == ActionType.CLOSE_CASE and obs.current_risk < 2.0:
            all_critical_verified = all(
                cf in [vf.lower() for vf in obs.verified_facts]
                for cf in h.critical_facts[:2]  # At least first 2 critical facts
            )
            if all_critical_verified and self._dispatch_occurred:
                r.completion_bonus = 0.5

        r.total = round(sum([
            r.info_gain, r.risk_reduction, r.efficiency_bonus,
            r.delay_penalty, r.premature_penalty, r.unsafe_penalty, r.completion_bonus
        ]), 4)
        r.total = max(-1.0, min(1.0, r.total))

        if not r.description:
            r.description = (
                f"gain={r.info_gain:.2f} risk_red={r.risk_reduction:.2f} "
                f"eff={r.efficiency_bonus:.2f} delay={r.delay_penalty:.2f} "
                f"premature={r.premature_penalty:.2f} unsafe={r.unsafe_penalty:.2f} "
                f"complete={r.completion_bonus:.2f}"
            )

        return r

    def _check_fail_condition(self, condition: str, action: Action) -> bool:
        content_lower = action.content.lower()
        if condition == "dispatch_emergency_services":
            return action.action_type == ActionType.DISPATCH_SERVICE
        if condition == "give_aspirin_without_checking_medications":
            med_verified = "current_medications" in [vf.lower() for vf in self._obs.verified_facts]
            return "aspirin" in content_lower and not med_verified
        if condition == "delay_dispatch_beyond_step_4":
            return (not self._dispatch_occurred and self._step_num > 4
                    and self._hidden.actual_severity > 0.8)
        if condition == "close_case_without_location":
            loc_verified = any("location" in vf.lower() for vf in self._obs.verified_facts)
            return action.action_type == ActionType.CLOSE_CASE and not loc_verified
        if condition == "close_case_while_patient_critical":
            return (action.action_type == ActionType.CLOSE_CASE
                    and self._obs.current_risk > 5.0)
        return False

    def _check_termination(self, action: Action):
        done = self._done  # may already be True from fail condition
        truncated = self._step_num >= self.MAX_STEPS
        reason = "ongoing"

        if done:
            reason = "fail_condition_triggered"
        elif action.action_type == ActionType.CLOSE_CASE:
            done = True
            reason = "agent_closed_case"
        elif truncated:
            reason = "max_steps_reached"
        elif (self._dispatch_occurred
              and len(self._obs.verified_facts) >= len(self._hidden.critical_facts) // 2
              and self._obs.current_risk < 2.0):
            done = True
            reason = "successful_resolution"

        return done, truncated, reason

    def _build_observation(self, user_message: str) -> Observation:
        obs = self._obs

        # Observation noise: higher panic = noisier obs
        obs_noise = min(0.9, obs.panic_level * 0.7 + random.gauss(0, 0.05))

        # Hint: vague contextual cue (not the hidden state)
        hint = None
        if obs.current_risk > 5.0:
            hint = "Situation appears severe. Expedite critical actions."
        elif obs.panic_level > 0.7:
            hint = "User is highly distressed. Calming may improve info quality."
        elif len(obs.verified_facts) == 0 and self._step_num > 2:
            hint = "No facts verified yet. Consider information gathering."

        return Observation(
            session_id=self._session_id,
            step_num=self._step_num,
            category=self._scenario["category"],
            panic_level=round(obs.panic_level, 3),
            time_elapsed=round(obs.time_elapsed, 2),
            current_risk=round(obs.current_risk, 3),
            verified_facts=list(obs.verified_facts),
            user_message=user_message,
            conversation_len=len(obs.conversation),
            available_actions=[a.value for a in ActionType],
            observation_noise=round(obs_noise, 3),
            hint=hint,
        )

    def _reveal_hidden(self) -> Dict:
        """Only called at episode end for analysis/grading."""
        h = self._hidden
        return {
            "true_risk_rate":       h.true_risk_rate,
            "actual_severity":      h.actual_severity,
            "user_truthfulness":    h.user_truthfulness,
            "hidden_complications": h.hidden_complications,
            "complication_triggered": h.complication_triggered,
            "optimal_dispatch_step": h.optimal_dispatch_step,
        }


# ─────────────────────────────────────────────
# Convenience singleton
# ─────────────────────────────────────────────
pomdp_env = TrustAidPOMDP()


if __name__ == "__main__":
    import json

    print("=== TrustAid POMDP Self-Test ===\n")
    env = TrustAidPOMDP()

    for scenario_id in SCENARIOS.keys():
        print(f"Scenario: {scenario_id}")
        obs = env.reset(scenario_id)
        print(f"  Initial message : {obs.user_message}")
        print(f"  Initial risk    : {obs.current_risk}")
        print(f"  Initial panic   : {obs.panic_level}")

        # Run 3 steps
        actions = [
            Action(action_type=ActionType.PROVIDE_GUIDANCE, content="Stay calm. I am here to help you."),
            Action(action_type=ActionType.ASK_QUESTION, content="Can you tell me your exact location?"),
            Action(action_type=ActionType.VERIFY_FACT, content="Verifying location", target_fact="current_location"),
        ]

        total_r = 0.0
        for a in actions:
            result = env.step(a)
            total_r += result.reward
            print(f"  Step {result.observation.step_num}: {a.action_type} → reward={result.reward:.3f} | risk={result.observation.current_risk:.2f}")

        print(f"  Cumulative reward: {total_r:.3f}")
        print(f"  State: {json.dumps(env.state(), indent=2)}\n")
