-- CreateTable
CREATE TABLE "SaasOwner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsapp_number" TEXT,
    "whatsapp_status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "owner_phone" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#f97316',
    "access_cooldown" INTEGER NOT NULL DEFAULT 5,
    "max_daily_access" INTEGER NOT NULL DEFAULT 1,
    "opening_time" TEXT,
    "closing_time" TEXT,
    "gate_token" TEXT,
    "turnstile_brand" TEXT DEFAULT 'generic',
    "enable_scheduling" BOOLEAN NOT NULL DEFAULT false,
    "saas_plan_id" TEXT,
    "saas_plan_expires_at" DATETIME,
    "asaas_customer_id" TEXT,
    "subscription_id" TEXT,
    "subscription_cycle" TEXT,
    "payment_method" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_saas_plan_id_fkey" FOREIGN KEY ("saas_plan_id") REFERENCES "SaasPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL DEFAULT 'TREINO',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Appointment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TREINO',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberSchedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberSchedule_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "checkin_success" TEXT NOT NULL DEFAULT '✅ Acesso Liberado! Bom treino, {name}.',
    "plan_warning" TEXT NOT NULL DEFAULT '⚠️ Olá {name}, seu plano venceu hoje. Passe na recepção para renovar.',
    "plan_expired" TEXT NOT NULL DEFAULT '🚫 {name}, seu plano venceu hoje. Passe na recepção para renovar.',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationSettings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaasPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "description" TEXT,
    "features" TEXT,
    "max_members" INTEGER NOT NULL DEFAULT 50,
    "duration_months" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PaymentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "asaas_payment_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" DATETIME,
    CONSTRAINT "PaymentHistory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GymAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    CONSTRAINT "GymAdmin_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    CONSTRAINT "Plan_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "plan_id" TEXT,
    "plan_start_date" DATETIME,
    "plan_end_date" DATETIME,
    "cpf" TEXT,
    "address" TEXT,
    "diet_plan" TEXT,
    "workout_routine" TEXT,
    "tenant_id" TEXT NOT NULL,
    CONSTRAINT "Member_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Member_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "member_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" DATETIME NOT NULL,
    "paid_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "last_message" TEXT,
    "last_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "value" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Lead_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "member_id" TEXT,
    "content" TEXT NOT NULL,
    "from_me" BOOLEAN NOT NULL DEFAULT false,
    "jid" TEXT NOT NULL,
    "media_url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "member_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    CONSTRAINT "AccessLog_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "site_name" TEXT NOT NULL DEFAULT 'ZapFitness',
    "logo_url" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasOwner_email_key" ON "SaasOwner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_whatsapp_number_key" ON "Tenant"("whatsapp_number");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_gate_token_key" ON "Tenant"("gate_token");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_tenant_id_key" ON "NotificationSettings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "GymAdmin_email_key" ON "GymAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_phone_tenant_id_key" ON "Member"("phone", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_tenant_id_key" ON "Lead"("phone", "tenant_id");
