-- v10 마이그레이션: 회원/부서 삭제 시 FK cascade / set null 정리
-- 문제:
--   DELETE /admin/users/{id} → 연결 데이터가 있으면 500 (RESTRICT 걸려 있음)
--   DELETE /admin/departments/{id} → 담당자/민원/매핑 참조로 500
-- 해결:
--   User 참조: 개인 데이터(민원·알림·세션)는 CASCADE, 감사 성격(첨부 업로더·상태변경자)은 SET NULL
--   Department 참조: 담당자·민원 부서는 SET NULL, 카테고리 매핑은 CASCADE
--   Complaint 참조 (연쇄 삭제용): 첨부·응답·이력은 CASCADE, 알림은 SET NULL

-- ==================== User 참조 ====================
-- chat_sessions.user_id → CASCADE
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- complaints.user_id → CASCADE
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS fk_complaints_user_id_users_user_id;
ALTER TABLE complaints ADD CONSTRAINT complaints_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- notifications.user_id → CASCADE
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_user_id_users_user_id;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- complaint_attachments.uploaded_by → SET NULL (첨부 자체는 유지, 업로더만 익명화)
ALTER TABLE complaint_attachments DROP CONSTRAINT IF EXISTS complaint_attachments_uploaded_by_fkey;
ALTER TABLE complaint_attachments ADD CONSTRAINT complaint_attachments_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- complaint_status_history.changed_by → SET NULL (감사 이력 보존)
ALTER TABLE complaint_status_history DROP CONSTRAINT IF EXISTS fk_complaint_status_history_changed_by_users_user_id;
ALTER TABLE complaint_status_history ADD CONSTRAINT complaint_status_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- ==================== Complaint 참조 (유저 삭제 시 연쇄 정리용) ====================
-- complaint_attachments.complaint_id → CASCADE
ALTER TABLE complaint_attachments DROP CONSTRAINT IF EXISTS fk_complaint_attachments_complaint_id_complaints_complaint_id;
ALTER TABLE complaint_attachments ADD CONSTRAINT complaint_attachments_complaint_id_fkey
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE;

-- complaint_responses.complaint_id → CASCADE
ALTER TABLE complaint_responses DROP CONSTRAINT IF EXISTS fk_complaint_responses_complaint_id_complaints_complaint_id;
ALTER TABLE complaint_responses ADD CONSTRAINT complaint_responses_complaint_id_fkey
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE;

-- complaint_status_history.complaint_id → CASCADE
ALTER TABLE complaint_status_history DROP CONSTRAINT IF EXISTS fk_complaint_status_history_complaint_id_complaints_complaint_i;
ALTER TABLE complaint_status_history ADD CONSTRAINT complaint_status_history_complaint_id_fkey
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE;

-- notifications.complaint_id → SET NULL (알림 자체는 남기고 참조만 해제)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_complaint_id_complaints_complaint_id;
ALTER TABLE notifications ADD CONSTRAINT notifications_complaint_id_fkey
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE SET NULL;

-- ==================== Department 참조 ====================
-- users.department_id → SET NULL (담당자 부서 해제)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL;

-- complaints.assigned_department_id → SET NULL
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS fk_complaints_assigned_department_id_departments_department_id;
ALTER TABLE complaints ADD CONSTRAINT complaints_assigned_department_id_fkey
    FOREIGN KEY (assigned_department_id) REFERENCES departments(department_id) ON DELETE SET NULL;

-- category_department_mapping.department_id → CASCADE (매핑 row 자체 삭제)
ALTER TABLE category_department_mapping DROP CONSTRAINT IF EXISTS fk_category_department_mapping_department_id_departments_depart;
ALTER TABLE category_department_mapping ADD CONSTRAINT category_department_mapping_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE;
