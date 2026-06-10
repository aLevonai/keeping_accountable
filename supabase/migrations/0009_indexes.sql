-- Cover the foreign keys on the hot paths. The core query (goals for a couple
-- joined to their completions) and the period counts were doing sequential
-- scans. couple_members(couple_id) is already covered by the PK prefix;
-- couple_invites(code) is already unique.

create index if not exists goals_couple_id_idx
  on public.goals (couple_id);

create index if not exists completions_goal_id_idx
  on public.completions (goal_id);

create index if not exists completions_user_id_idx
  on public.completions (user_id);

create index if not exists completions_goal_completed_idx
  on public.completions (goal_id, completed_at);

create index if not exists dreams_couple_id_idx
  on public.dreams (couple_id);

create index if not exists completion_media_completion_id_idx
  on public.completion_media (completion_id);

create index if not exists couple_members_user_id_idx
  on public.couple_members (user_id);
