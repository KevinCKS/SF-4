-- 7.1 alert_settings 테이블 생성
CREATE TABLE public.alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
    min_value NUMERIC, -- 하한값
    max_value NUMERIC, -- 상한값
    notify_email TEXT, -- 알림 받을 이메일
    is_active BOOLEAN DEFAULT true, -- 활성화 여부
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- farm_id 또는 sensor_id 중 하나는 반드시 있어야 함
    CONSTRAINT farm_or_sensor_check CHECK (farm_id IS NOT NULL OR sensor_id IS NOT NULL)
);

-- RLS 설정 (인증된 사용자만 접근 가능)
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read for alert_settings" ON public.alert_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms f 
            WHERE f.id = alert_settings.farm_id AND f.user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.sensors s
            JOIN public.farms f ON s.farm_id = f.id
            WHERE s.id = alert_settings.sensor_id AND f.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow individual insert/update/delete for alert_settings" ON public.alert_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.farms f 
            WHERE f.id = alert_settings.farm_id AND f.user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.sensors s
            JOIN public.farms f ON s.farm_id = f.id
            WHERE s.id = alert_settings.sensor_id AND f.user_id = auth.uid()
        )
    );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alert_settings_updated_at
    BEFORE UPDATE ON public.alert_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
