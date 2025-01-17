-- Create Users table
CREATE TABLE IF NOT EXISTS "Users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, -- auto-incrementing ID
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "status" VARCHAR(255) DEFAULT 'active',
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

-- Create Wallets table
CREATE TABLE IF NOT EXISTS "Wallets" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, -- auto-incrementing ID
    "userid" INTEGER NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    FOREIGN KEY ("userid") REFERENCES "Users"("id")
);

-- Create Transactions table
CREATE TABLE IF NOT EXISTS "Transactions" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, -- auto-incrementing ID
    "userid" INTEGER NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(255) DEFAULT 'pending',
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    FOREIGN KEY ("userid") REFERENCES "Users"("id")
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON "Users"("email");
CREATE INDEX idx_wallets_userid ON "Wallets"("userid");
CREATE INDEX idx_transactions_userid ON "Transactions"("userid");
CREATE INDEX idx_transactions_status ON "Transactions"("status");
