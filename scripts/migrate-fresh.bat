@echo off
REM Fresh Database Migration Script for Windows
REM This script will backup, drop, and recreate all tables

echo ========================================
echo   WorkDesk24 - Fresh Database Migration
echo ========================================
echo.

REM Configuration
set DB_NAME=workdesk24
set DB_USER=root
set BACKUP_DIR=backups
set TIMESTAMP=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.sql

echo [WARNING] THIS WILL DROP ALL TABLES AND RECREATE THEM!
echo [WARNING] ALL EXISTING DATA WILL BE LOST!
echo.
set /p REVIEWED="Have you reviewed MIGRATION_GUIDE.md? (yes/no): "

if not "%REVIEWED%"=="yes" (
    echo.
    echo [ERROR] Please review MIGRATION_GUIDE.md first!
    pause
    exit /b 1
)

echo.
set /p CONFIRM="Do you want to proceed? (yes/no): "

if not "%CONFIRM%"=="yes" (
    echo.
    echo [INFO] Migration cancelled
    pause
    exit /b 0
)

echo.
echo [INFO] Starting migration process...
echo.

REM Create backup directory
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
    echo [INFO] Created backup directory: %BACKUP_DIR%
)

REM Backup database
echo [INFO] Creating backup: %BACKUP_FILE%
echo [WARNING] This may take a few minutes for large databases...
set /p DB_PASSWORD="Enter MySQL password: "

mysqldump -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Backup created successfully
) else (
    echo [ERROR] Backup failed!
    pause
    exit /b 1
)

REM Run migrations
echo.
echo [INFO] Running migrations...
call npm run db:migrate

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Migrations completed successfully
) else (
    echo [ERROR] Migration failed! Restore from backup: %BACKUP_FILE%
    pause
    exit /b 1
)

REM Verify tables
echo.
echo [INFO] Verifying tables...
mysql -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% -e "SHOW TABLES;" > temp_tables.txt 2>&1
findstr /C:"wd_" temp_tables.txt > nul
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Tables created successfully
) else (
    echo [WARNING] Please verify tables manually
)
del temp_tables.txt

REM Verify admin user
echo.
echo [INFO] Verifying admin user...
mysql -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% -e "SELECT email FROM wd_users WHERE email='admin@workdesk24.com';" > temp_admin.txt 2>&1
findstr /C:"admin@workdesk24.com" temp_admin.txt > nul
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Admin user created
    echo.
    echo Email: admin@workdesk24.com
    echo Password: admin123
    echo [WARNING] CHANGE PASSWORD IMMEDIATELY!
) else (
    echo [WARNING] Admin user not found
)
del temp_admin.txt

echo.
echo ========================================
echo [SUCCESS] Migration completed!
echo ========================================
echo.
echo [INFO] Backup saved to: %BACKUP_FILE%
echo [INFO] Next steps:
echo   1. Test the application
echo   2. Change admin password
echo   3. Update mobile app
echo   4. Update API documentation
echo.

pause
