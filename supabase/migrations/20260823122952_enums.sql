-- Enums (spec 06.1). Transcribed verbatim from the data model; this file is the
-- executable copy of that table. Adding a value later is `alter type ... add value`,
-- which cannot run inside a transaction block — so it gets its own migration.

create type geo_type        as enum ('ut','district','block','village','town','panchayat','municipality');
create type user_role       as enum ('member','driver','panchayat_admin','dept_liaison','district_admin','super_admin');
create type visibility      as enum ('villagers','officials','nobody');
create type mod_status      as enum ('pending','approved','rejected');
create type place_category  as enum ('school','hospital','mosque','imambargah','khanqah',
                                     'government_office','bank_atm','water_point','tourist',
                                     'market','sports','other');
create type notice_category as enum ('vacation','order','event','alert','general');
create type gallery_kind    as enum ('place','festival','general');

create type vehicle_type    as enum ('xylo','innova','tempo_traveller','bus_large',
                                     'omni','eeco','bus_small','other');
create type trip_class      as enum ('long','short');
create type trip_mode       as enum ('shared','charter');
create type trip_status     as enum ('open','filling','confirmed','departed','completed','cancelled');
create type seat_status     as enum ('free','held','booked','blocked');
create type seat_kind       as enum ('driver','window','middle','aisle','folding');
create type booking_status  as enum ('requested','confirmed','cancelled_by_passenger',
                                     'cancelled_by_driver','no_show','completed');

create type event_category  as enum ('religious_islamic','religious_buddhist',
                                     'cultural_local','national','civic_local');
create type issue_status    as enum ('submitted','acknowledged','forwarded','in_progress',
                                     'resolved','rejected','reopened');
