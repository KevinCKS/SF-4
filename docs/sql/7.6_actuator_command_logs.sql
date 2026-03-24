-- 액추에이터 MQTT 제어 이력 (대시보드 최근 제어 목록용)

CREATE TABLE public.actuator_command_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actuator_key TEXT NOT NULL CHECK (actuator_key IN ('led', 'pump', 'fan1', 'fan2')),
    topic TEXT NOT NULL,
    payload TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actuator_command_logs_farm_id_created_at_idx
    ON public.actuator_command_logs (farm_id, created_at DESC);

ALTER TABLE public.actuator_command_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actuator_command_logs_select_own_farm" ON public.actuator_command_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms f
            WHERE f.id = actuator_command_logs.farm_id AND f.user_id = auth.uid()
        )
    );

CREATE POLICY "actuator_command_logs_insert_own_farm" ON public.actuator_command_logs
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.farms f
            WHERE f.id = farm_id AND f.user_id = auth.uid()
        )
    );
