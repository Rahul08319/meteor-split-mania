CREATE TABLE public.game_saves (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocks JSONB NOT NULL DEFAULT '{}'::jsonb,
  leaderboard JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_saves TO authenticated;
GRANT ALL ON public.game_saves TO service_role;
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own game save" ON public.game_saves FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_game_saves_updated_at BEFORE UPDATE ON public.game_saves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();