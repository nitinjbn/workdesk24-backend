-- Task Tags: manual deployment, MySQL 8+, using the application's database.
-- Back up first. Run BEFORE deploying the tag-enabled application.
-- MySQL DDL implicitly commits; a transaction cannot roll back these statements.
-- First-time installation only. Do not run this AND the Sequelize migration.
-- No existing task fields, numbers, counters or timestamps are modified.
--
-- Names are case-insensitively unique per host among non-deleted tags.
-- For existing installations, run the task-tag-active-name-uniqueness migration.
-- Mappings have the additional soft-delete fields required to remove assignments
-- without physically deleting records. Reassignment restores the existing row.
-- Replacing assignments only removes enabled/non-deleted tag assignments;
-- disabled/deleted-tag references remain readable as history.

CREATE TABLE wd_task_tags (
    id BIGINT NOT NULL AUTO_INCREMENT,
    hostId BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    description VARCHAR(255) NULL,
    isEnabled TINYINT NOT NULL DEFAULT 1,
    isDeleted TINYINT NOT NULL DEFAULT 0,
    activeName VARCHAR(50) GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN name ELSE NULL END) STORED,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NULL,
    deletedAt BIGINT NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_task_tags_host_active_name (hostId, activeName),
    KEY idx_task_tags_host_status (hostId, isDeleted, isEnabled),
    CONSTRAINT fk_task_tags_host FOREIGN KEY (hostId)
        REFERENCES wd_hosts (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wd_task_tag_mappings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    hostId BIGINT NOT NULL,
    taskId BIGINT NOT NULL,
    tagId BIGINT NOT NULL,
    isDeleted TINYINT NOT NULL DEFAULT 0,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NULL,
    deletedAt BIGINT NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_task_tag_mappings_host_task_tag (hostId, taskId, tagId),
    KEY idx_task_tag_mappings_host_task (hostId, taskId),
    KEY idx_task_tag_mappings_host_tag (hostId, tagId),
    CONSTRAINT fk_task_tag_mappings_host FOREIGN KEY (hostId)
        REFERENCES wd_hosts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_task_tag_mappings_task FOREIGN KEY (taskId)
        REFERENCES wd_tasks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_task_tag_mappings_tag FOREIGN KEY (tagId)
        REFERENCES wd_task_tags (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- After BOTH tables have been successfully created, record the equivalent
-- Sequelize migration so a later db:migrate does not attempt to recreate them.
-- Run only if this deployment uses the existing SequelizeMeta table.
INSERT INTO SequelizeMeta (name)
VALUES ('20261114130000-create-task-tags.js');

-- Read-only verification.
SHOW CREATE TABLE wd_task_tags;
SHOW CREATE TABLE wd_task_tag_mappings;
