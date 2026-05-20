// Run once to populate initial data: node src/db/seed.js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './index.js';

const HASH = (pw) => bcrypt.hashSync(pw, 10);

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Employees ─────────────────────────────────────────────────────────────
    const employees = [
      { email: 'sarah@bluebayou.com',    pw: 'password', name: 'Sarah Johnson',  role: 'crew_member', dept: 'Aquatics',         depts: ['Aquatics'],                                                    pos: 'Lifeguard',           avatar: 'SJ', phone: '(225) 555-0101', hire: '2024-05-15' },
      { email: 'manager@bluebayou.com',  pw: 'password', name: 'James Williams', role: 'manager',     dept: 'Management',       depts: ['Management','Aquatics','Guest Services','Food & Beverage'],   pos: 'Shift Manager',       avatar: 'JW', phone: '(225) 555-0100', hire: '2021-03-01' },
      { email: 'mike@bluebayou.com',     pw: 'password', name: 'Mike Rodriguez', role: 'crew_member', dept: 'Food & Beverage',  depts: ['Food & Beverage'],                                             pos: 'Team Member',         avatar: 'MR', phone: '(225) 555-0102', hire: '2025-04-10' },
      { email: 'emily@bluebayou.com',    pw: 'password', name: 'Emily Chen',     role: 'crew_member', dept: 'Guest Services',   depts: ['Guest Services'],                                              pos: 'Attendant',           avatar: 'EC', phone: '(225) 555-0103', hire: '2025-05-01' },
      { email: 'sysadmin@bluebayou.com', pw: 'password', name: 'Isaac Joyner',   role: 'sysadmin',    dept: 'Management',       depts: ['Management'],                                                  pos: 'System Administrator',avatar: 'IJ', phone: '(225) 555-0099', hire: '2020-01-01' },
    ];

    const empIds = [];
    for (const e of employees) {
      const { rows } = await client.query(
        `INSERT INTO employees (email,password_hash,name,role,department,departments,position,avatar,phone,hire_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [e.email, HASH(e.pw), e.name, e.role, e.dept, e.depts, e.pos, e.avatar, e.phone, e.hire]
      );
      empIds.push(rows[0].id);
    }
    const [sarahId, jamesId, mikeId, emilyId] = empIds;

    // ── Shifts ────────────────────────────────────────────────────────────────
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mon = (offset) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    const shifts = [
      [sarahId, mon(0), '09:00', '17:00', 'Aquatics',        'Lifeguard',     'Wave Pool'],
      [sarahId, mon(2), '12:00', '20:00', 'Aquatics',        'Lifeguard',     'Slide Area'],
      [sarahId, mon(4), '09:00', '17:00', 'Aquatics',        'Lifeguard',     'Lazy River'],
      [sarahId, mon(5), '08:00', '16:00', 'Aquatics',        'Lifeguard',     'Main Pool'],
      [jamesId, mon(0), '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, mon(1), '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, mon(3), '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, mon(4), '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [mikeId,  mon(0), '10:00', '18:00', 'Food & Beverage', 'Team Member',   'Snack Shack'],
      [mikeId,  mon(1), '10:00', '18:00', 'Food & Beverage', 'Team Member',   'Snack Shack'],
      [mikeId,  mon(5), '09:00', '17:00', 'Food & Beverage', 'Team Member',   'Main Concessions'],
      [mikeId,  mon(6), '09:00', '17:00', 'Food & Beverage', 'Team Member',   'Main Concessions'],
      [emilyId, mon(1), '08:00', '16:00', 'Guest Services',  'Attendant',     'Main Entrance'],
      [emilyId, mon(2), '08:00', '16:00', 'Guest Services',  'Attendant',     'Main Entrance'],
      [emilyId, mon(4), '10:00', '18:00', 'Guest Services',  'Attendant',     'Cabana Rentals'],
      [emilyId, mon(6), '10:00', '18:00', 'Guest Services',  'Attendant',     'Cabana Rentals'],
    ];

    for (const [empId, date, start, end, dept, pos, loc] of shifts) {
      await client.query(
        `INSERT INTO shifts (employee_id,date,start_time,end_time,department,position,location)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [empId, date, start, end, dept, pos, loc]
      );
    }

    // ── Draft shifts (next week) ──────────────────────────────────────────────
    const nextMon = new Date(monday);
    nextMon.setDate(monday.getDate() + 7);
    const nxt = (offset) => {
      const d = new Date(nextMon);
      d.setDate(nextMon.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    const drafts = [
      [sarahId, nxt(0),  '09:00', '17:00', 'Aquatics',        'Lifeguard',     'Wave Pool'],
      [sarahId, nxt(2),  '12:00', '20:00', 'Aquatics',        'Lifeguard',     'Slide Area'],
      [sarahId, nxt(7),  '09:00', '17:00', 'Aquatics',        'Lifeguard',     'Main Pool'],
      [jamesId, nxt(0),  '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, nxt(1),  '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, nxt(7),  '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [jamesId, nxt(9),  '08:00', '18:00', 'Management',      'Shift Manager', 'Park-Wide'],
      [mikeId,  nxt(0),  '10:00', '18:00', 'Food & Beverage', 'Team Member',   'Snack Shack'],
      [mikeId,  nxt(5),  '09:00', '17:00', 'Food & Beverage', 'Team Member',   'Main Concessions'],
      [emilyId, nxt(1),  '08:00', '16:00', 'Guest Services',  'Attendant',     'Main Entrance'],
      [emilyId, nxt(3),  '10:00', '18:00', 'Guest Services',  'Attendant',     'Cabana Rentals'],
      [emilyId, nxt(8),  '08:00', '16:00', 'Guest Services',  'Attendant',     'Main Entrance'],
    ];

    for (const [empId, date, start, end, dept, pos, loc] of drafts) {
      await client.query(
        `INSERT INTO draft_shifts (employee_id,date,start_time,end_time,department,position,location)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [empId, date, start, end, dept, pos, loc]
      );
    }

    // ── Announcements ─────────────────────────────────────────────────────────
    const announcements = [
      { title: 'Park Opens Saturday at 9am — All Hands Required', body: 'This Saturday is our biggest attendance day of the season. All staff must report 30 minutes before their shift for a quick uniform check.', dept: null, priority: 'high' },
      { title: 'Updated Break Room Schedule', body: 'The break room schedule has been updated for the summer season. Please review the posted schedule and coordinate with your team lead if you have a conflict.', dept: null, priority: 'normal' },
      { title: 'Employee of the Month — May 2026', body: 'Congratulations to Sarah Johnson (Aquatics) for consistently going above and beyond for our guests this month. A gift card is waiting at the front office!', dept: null, priority: 'normal' },
      { title: 'Reminder: Sun Safety Policy', body: 'All outdoor staff must apply SPF 30+ sunscreen every two hours. Sunscreen is available at each lifeguard station and the main office.', dept: null, priority: 'normal' },
      { title: 'Rotation Schedule Update — Wave Pool', body: 'Effective this weekend the wave pool rotation will shift to 20-minute intervals. Please review the new board at the guard station before your shift.', dept: 'Aquatics', priority: 'high' },
      { title: 'New POS System Training — Thursday', body: 'We are upgrading to a new point-of-sale system. All Food & Beverage staff must attend a 20-minute training session Thursday before your shift.', dept: 'Food & Beverage', priority: 'normal' },
      { title: 'Guest Services Scripts Updated', body: 'The standard greeting and upsell scripts for cabana rentals and season passes have been updated. Printed copies are at the information desk.', dept: 'Guest Services', priority: 'normal' },
    ];

    for (const a of announcements) {
      await client.query(
        `INSERT INTO announcements (title,body,author_id,author_name,author_avatar,department,priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [a.title, a.body, jamesId, 'James Williams', 'JW', a.dept, a.priority]
      );
    }

    // ── Conversations ─────────────────────────────────────────────────────────
    const { rows: [aqConvo] } = await client.query(
      `INSERT INTO conversations (name, type) VALUES ('Aquatics Team','group')
       ON CONFLICT DO NOTHING RETURNING id`
    );
    const { rows: [allConvo] } = await client.query(
      `INSERT INTO conversations (name, type) VALUES ('All Staff','group')
       ON CONFLICT DO NOTHING RETURNING id`
    );
    const { rows: [dmConvo] } = await client.query(
      `INSERT INTO conversations (name, type) VALUES (NULL,'direct')
       ON CONFLICT DO NOTHING RETURNING id`
    );

    if (aqConvo?.id) {
      await client.query(`INSERT INTO conversation_members VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING`, [aqConvo.id, sarahId, jamesId]);
      await client.query(`INSERT INTO messages (conversation_id,sender_id,text,sent_at) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$2,$8,$9)`, [
        aqConvo.id, jamesId, 'Morning team! Big day ahead — please check the rotation board before your shift.', '2026-05-18T07:55:00Z',
        sarahId, 'Got it! Will do.', '2026-05-18T08:10:00Z',
        'Don\'t forget — rotation starts at 10am sharp.', '2026-05-18T08:30:00Z',
      ]);
    }
    if (allConvo?.id) {
      await client.query(`INSERT INTO conversation_members VALUES ($1,$2),($1,$3),($1,$4),($1,$5) ON CONFLICT DO NOTHING`, [allConvo.id, sarahId, jamesId, mikeId, emilyId]);
      await client.query(`INSERT INTO messages (conversation_id,sender_id,text,sent_at) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)`, [
        allConvo.id, jamesId, 'Park opens at 9am this Saturday. All hands on deck!', '2026-05-17T16:00:00Z',
        mikeId, 'I\'ll be there at 8:30.', '2026-05-17T16:15:00Z',
        emilyId, 'Same here!', '2026-05-17T16:20:00Z',
      ]);
    }
    if (dmConvo?.id) {
      await client.query(`INSERT INTO conversation_members VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING`, [dmConvo.id, sarahId, jamesId]);
      await client.query(`INSERT INTO messages (conversation_id,sender_id,text,sent_at) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$5,$8,$9),($1,$2,$10,$11)`, [
        dmConvo.id,
        sarahId, 'Hey James, any chance I can get Sunday off? I have a family event.', '2026-05-16T13:00:00Z',
        jamesId, 'Let me check the schedule...', '2026-05-16T14:00:00Z',
        'You\'re approved for Sunday off.', '2026-05-16T14:22:00Z',
        'Thank you so much!', '2026-05-16T14:25:00Z',
      ]);
    }

    await client.query('COMMIT');
    console.log('✓ Database seeded successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
