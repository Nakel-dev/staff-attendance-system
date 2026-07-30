-- Allow removing kiosks while keeping attendance history.

alter table attendance_records alter column kiosk_device_id drop not null;

alter table attendance_records drop constraint if exists attendance_records_kiosk_device_id_fkey;

alter table attendance_records
  add constraint attendance_records_kiosk_device_id_fkey
  foreign key (kiosk_device_id) references kiosks(id) on delete set null;
