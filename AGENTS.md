# Project rules

- Signup (OnboardingQuestionnaire) asks only essentials; the other questions live in the Today "Complete your profile" card, which reuses the same step components via `essentialsOnly` / `extrasOnly` props. Why: one source of question UI for both places.
- Profile sections save as partial `user_baselines` updates (`saveProfileSection`), never through `saveUserBaseline`, and recalculate targets only when a target-affecting field is included (`affectsTargets`). Why: `saveUserBaseline` overwrites the whole row.
