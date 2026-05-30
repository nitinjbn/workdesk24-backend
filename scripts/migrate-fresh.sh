#!/bin/bash

# Fresh Database Migration Script
# This script will backup, drop, and recreate all tables

set -e  # Exit on any error

echo "========================================"
echo "  WorkDesk24 - Fresh Database Migration"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-workdesk24}"
DB_USER="${DB_USER:-root}"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Functions
error() {
    echo -e "${RED}❌ Error: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "ℹ️  $1"
}

# Check if MySQL is accessible
check_mysql() {
    info "Checking MySQL connection..."
    if ! mysql -u "$DB_USER" -p -e "SELECT 1;" >/dev/null 2>&1; then
        error "Cannot connect to MySQL. Check credentials."
    fi
    success "MySQL connection OK"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup database
backup_database() {
    info "Creating backup: $BACKUP_FILE"
    warning "This may take a few minutes for large databases..."

    if mysqldump -u "$DB_USER" -p "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        success "Backup created successfully ($BACKUP_SIZE)"
    else
        error "Backup failed!"
    fi
}

# Run migrations
run_migrations() {
    info "Running migrations..."

    if npm run db:migrate; then
        success "Migrations completed successfully"
    else
        error "Migration failed! Restore from backup: $BACKUP_FILE"
    fi
}

# Verify tables
verify_tables() {
    info "Verifying tables..."

    TABLES=$(mysql -u "$DB_USER" -p "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | grep "^wd_" | wc -l)

    if [ "$TABLES" -eq 9 ]; then
        success "All 9 tables created successfully"
    else
        warning "Expected 9 tables, found $TABLES"
    fi
}

# Verify admin user
verify_admin() {
    info "Verifying admin user..."

    ADMIN_EXISTS=$(mysql -u "$DB_USER" -p "$DB_NAME" -e "SELECT COUNT(*) as cnt FROM wd_users WHERE email='admin@workdesk24.com';" 2>/dev/null | tail -1)

    if [ "$ADMIN_EXISTS" -eq 1 ]; then
        success "Admin user created"
        echo ""
        echo "📧 Email: admin@workdesk24.com"
        echo "🔑 Password: admin123"
        warning "CHANGE PASSWORD IMMEDIATELY!"
    else
        warning "Admin user not found"
    fi
}

# Main execution
main() {
    echo ""
    warning "⚠️  THIS WILL DROP ALL TABLES AND RECREATE THEM! ⚠️"
    warning "⚠️  ALL EXISTING DATA WILL BE LOST! ⚠️"
    echo ""
    read -p "Have you reviewed MIGRATION_GUIDE.md? (yes/no): " REVIEWED

    if [ "$REVIEWED" != "yes" ]; then
        error "Please review MIGRATION_GUIDE.md first!"
    fi

    echo ""
    read -p "Do you want to proceed? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        info "Migration cancelled"
        exit 0
    fi

    echo ""
    info "Starting migration process..."
    echo ""

    # Execute steps
    check_mysql
    create_backup_dir
    backup_database
    run_migrations
    verify_tables
    verify_admin

    echo ""
    echo "========================================"
    success "Migration completed successfully!"
    echo "========================================"
    echo ""
    info "Backup saved to: $BACKUP_FILE"
    info "Next steps:"
    echo "  1. Test the application"
    echo "  2. Change admin password"
    echo "  3. Update mobile app"
    echo "  4. Update API documentation"
    echo ""
}

# Run main
main
