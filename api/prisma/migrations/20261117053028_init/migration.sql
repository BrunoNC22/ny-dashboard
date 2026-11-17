-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(16) NOT NULL,
    "palette" VARCHAR(32) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "borough" VARCHAR(16) NOT NULL,
    "service_zone" VARCHAR(16) NOT NULL,
    "centroid_lon" DOUBLE PRECISION,
    "centroid_lat" DOUBLE PRECISION,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_daily" (
    "date" DATE NOT NULL,
    "service" VARCHAR(8) NOT NULL,
    "company" VARCHAR(8) NOT NULL,
    "pu_zone_id" SMALLINT NOT NULL,
    "trips" INTEGER NOT NULL,
    "passengers" INTEGER,
    "passenger_trips" INTEGER,
    "revenue" DOUBLE PRECISION NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "tips" DOUBLE PRECISION NOT NULL,
    "distance_mi" DOUBLE PRECISION NOT NULL,
    "duration_s" BIGINT NOT NULL,
    "airport_trips" INTEGER NOT NULL,
    "card_trips" INTEGER,
    "cash_trips" INTEGER,
    "cbd_fee" DOUBLE PRECISION NOT NULL,
    "wait_s" BIGINT,
    "wait_trips" INTEGER,
    "driver_pay" DOUBLE PRECISION,
    "shared_trips" INTEGER,

    CONSTRAINT "trip_daily_pkey" PRIMARY KEY ("date","service","company","pu_zone_id")
);

-- CreateTable
CREATE TABLE "trip_hourly" (
    "hour" TIMESTAMP(0) NOT NULL,
    "service" VARCHAR(8) NOT NULL,
    "company" VARCHAR(8) NOT NULL,
    "trips" INTEGER NOT NULL,
    "passengers" INTEGER,
    "passenger_trips" INTEGER,
    "revenue" DOUBLE PRECISION NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "tips" DOUBLE PRECISION NOT NULL,
    "distance_mi" DOUBLE PRECISION NOT NULL,
    "duration_s" BIGINT NOT NULL,
    "airport_trips" INTEGER NOT NULL,
    "card_trips" INTEGER,
    "cash_trips" INTEGER,
    "cbd_fee" DOUBLE PRECISION NOT NULL,
    "wait_s" BIGINT,
    "wait_trips" INTEGER,
    "driver_pay" DOUBLE PRECISION,
    "shared_trips" INTEGER,

    CONSTRAINT "trip_hourly_pkey" PRIMARY KEY ("hour","service","company")
);

-- CreateTable
CREATE TABLE "od_flow_monthly" (
    "month" DATE NOT NULL,
    "service" VARCHAR(8) NOT NULL,
    "company" VARCHAR(8) NOT NULL,
    "pu_borough" VARCHAR(16) NOT NULL,
    "pu_zone_id" SMALLINT NOT NULL,
    "do_zone_id" SMALLINT NOT NULL,
    "trips" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "distance_mi" DOUBLE PRECISION NOT NULL,
    "duration_s" BIGINT NOT NULL,

    CONSTRAINT "od_flow_monthly_pkey" PRIMARY KEY ("month","service","company","pu_zone_id","do_zone_id")
);

-- CreateTable
CREATE TABLE "trip_sample" (
    "sample_id" INTEGER NOT NULL,
    "service" VARCHAR(8) NOT NULL,
    "company" VARCHAR(8) NOT NULL,
    "pickup_at" TIMESTAMP(0) NOT NULL,
    "pu_zone_id" SMALLINT NOT NULL,
    "do_zone_id" SMALLINT,
    "distance_mi" DOUBLE PRECISION NOT NULL,
    "duration_s" INTEGER NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "tips" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "wait_s" INTEGER,
    "lon" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,

    CONSTRAINT "trip_sample_pkey" PRIMARY KEY ("sample_id")
);

-- CreateTable
CREATE TABLE "projection" (
    "date" DATE NOT NULL,
    "service" VARCHAR(8) NOT NULL,
    "borough" VARCHAR(16) NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "trips" DOUBLE PRECISION NOT NULL,
    "passengers" DOUBLE PRECISION,
    "passenger_trips" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "tips" DOUBLE PRECISION NOT NULL,
    "distance_mi" DOUBLE PRECISION NOT NULL,
    "duration_s" DOUBLE PRECISION NOT NULL,
    "airport_trips" DOUBLE PRECISION NOT NULL,
    "card_trips" DOUBLE PRECISION,
    "cash_trips" DOUBLE PRECISION,
    "cbd_fee" DOUBLE PRECISION NOT NULL,
    "wait_s" DOUBLE PRECISION,
    "wait_trips" DOUBLE PRECISION,
    "driver_pay" DOUBLE PRECISION,
    "shared_trips" DOUBLE PRECISION,

    CONSTRAINT "projection_pkey" PRIMARY KEY ("date","service","borough")
);

-- CreateTable
CREATE TABLE "seed_meta" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seed_meta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "dashboards_user_id_key" ON "dashboards"("user_id");

-- CreateIndex
CREATE INDEX "zones_borough_idx" ON "zones"("borough");

-- CreateIndex
CREATE INDEX "trip_daily_pu_zone_id_date_idx" ON "trip_daily"("pu_zone_id", "date");

-- CreateIndex
CREATE INDEX "od_flow_monthly_month_pu_borough_idx" ON "od_flow_monthly"("month", "pu_borough");

-- CreateIndex
CREATE INDEX "trip_sample_service_company_idx" ON "trip_sample"("service", "company");

-- CreateIndex
CREATE INDEX "trip_sample_pu_zone_id_idx" ON "trip_sample"("pu_zone_id");

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
