-- 7.2 alert_logs 테이블 생성
CREATE TABLE public.alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_setting_id UUID REFERENCES public.alert_settings(id) ON DELETE CASCADE,
    sensor_reading_id UUID REFERENCES public.sensor_readings(id) ON DELETE SET NULL,
    message TEXT NOT NULL, -- 알림 메시지 (예: "온도 상한 초과: 32.5°C")
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 설정 (인증된 사용자만 본인 농장의 알림 로그 조회 가능)
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read for alert_logs" ON public.alert_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.alert_settings ast
            LEFT JOIN public.farms f ON ast.farm_id = f.id
            LEFT JOIN public.sensors s ON ast.sensor_id = s.id
            LEFT JOIN public.farms f2 ON s.farm_id = f2.id
            WHERE ast.id = alert_logs.alert_setting_id 
            AND (f.user_id = auth.uid() OR f2.user_id = auth.uid())
        )
    );
