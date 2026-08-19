-- Add default_hourly_rate to companies table
alter table companies add column if not exists default_hourly_rate numeric(10,2) not null default 0;
