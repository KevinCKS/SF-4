-- alert_logs: 농장 소유자가 본인 알림 로그를 삭제할 수 있도록 DELETE 정책 추가
-- (7.2에서 SELECT만 있었을 때 UI/API에서 DELETE가 RLS에 막혀 0건만 삭제되는 문제 방지)

CREATE POLICY "Allow individual delete for alert_logs" ON public.alert_logs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.alert_settings ast
            LEFT JOIN public.farms f ON ast.farm_id = f.id
            LEFT JOIN public.sensors s ON ast.sensor_id = s.id
            LEFT JOIN public.farms f2 ON s.farm_id = f2.id
            WHERE ast.id = alert_logs.alert_setting_id
            AND (f.user_id = auth.uid() OR f2.user_id = auth.uid())
        )
    );
