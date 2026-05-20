import { useState, useEffect } from 'react';
import { format, parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { fmt12 } from '../lib/time.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DEPT_COLOR } from '../components/Layout/Sidebar.jsx';

export default function Home() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/announcements/home')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = user?.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Greeting */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">{format(new Date(), 'EEEE, MMMM d · yyyy')}</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-tight">
            {greeting}, {first}.
          </h1>
        </div>
        <Link to="/schedule" className="btn-ghost text-xs">View full schedule →</Link>
      </div>

      {/* Next shift hero */}
      <div className="shrink-0">
        {loading ? (
          <ShiftHeroSkeleton />
        ) : data?.nextShift ? (
          <NextShiftHero shift={data.nextShift} />
        ) : (
          <div className="panel p-8 text-center">
            <p className="text-fog text-sm">No upcoming shifts scheduled.</p>
          </div>
        )}
      </div>

      {/* Bottom: upcoming + bulletin — fills remaining height */}
      {!loading && (
        <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

          {/* Up next */}
          <div className="panel p-5 flex flex-col min-h-0">
            <p className="label-xs mb-4 shrink-0">Up next</p>
            <div className="flex-1 overflow-y-auto divide-y divide-rim/40">
              {data?.upcomingShifts?.length === 0 ? (
                <p className="text-fog text-sm pt-2">Nothing else this week.</p>
              ) : (
                data.upcomingShifts.map(s => {
                  const dc = DEPT_COLOR[s.department];
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <div className={`w-0.5 h-8 rounded-full shrink-0 ${dc?.bar ?? 'bg-cyan'}`} />
                      <div>
                        <p className="text-ink text-sm font-semibold leading-tight">
                          {format(parseISO(s.date), 'EEE, MMM d')}
                        </p>
                        <p className="text-fog text-xs mt-0.5">
                          {fmt12(s.start)}–{fmt12(s.end)} · {s.location}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bulletin board — spans 2 cols */}
          <div className="col-span-2 panel p-5 flex flex-col min-h-0">
            <p className="label-xs mb-4 shrink-0">Bulletin board</p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {data?.announcements?.length === 0 ? (
                <p className="text-fog text-sm pt-2">No announcements.</p>
              ) : (
                data.announcements.map(a => <BulletinItem key={a.id} a={a} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NextShiftHero({ shift }) {
  const dc        = DEPT_COLOR[shift.department] ?? DEPT_COLOR['Aquatics'];
  const shiftDate = parseISO(shift.date);
  const isToday   = isSameDay(shiftDate, new Date());
  const start     = new Date(`${shift.date}T${shift.start}:00`);
  const minsLeft  = differenceInMinutes(start, new Date());

  let badge = null;
  if (isToday && minsLeft > 0 && minsLeft < 180)
    badge = `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m away`;
  else if (isToday && minsLeft <= 0 && minsLeft > -600)
    badge = 'In progress';

  return (
    <div
      className="relative panel overflow-hidden"
      style={{ boxShadow: `0 0 40px ${dc.glow}` }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${dc.bar}`} />

      <div className="pl-6 pr-6 py-6 flex items-center gap-8">
        {/* Time block */}
        <div className="flex-1">
          <p className="label-xs mb-3">Next shift</p>
          <p className="num-display text-5xl text-ink leading-none">
            {fmt12(shift.start)}
            <span className="text-fog mx-3 font-light">—</span>
            {fmt12(shift.end)}
          </p>
          <p className="text-white text-2xl font-heading font-bold mt-3 leading-tight">
            {isToday ? 'Today' : format(shiftDate, 'EEEE')},{' '}
            {format(shiftDate, 'MMMM d')}
          </p>
        </div>

        <div className="w-px self-stretch bg-rim/60" />

        {/* Details */}
        <div className="text-right min-w-52">
          {badge && (
            <span className={`inline-block mb-3 px-2.5 py-1 rounded text-10 font-bold tracking-widest uppercase ${dc.text} bg-shell border ${dc.ring}`}>
              {badge}
            </span>
          )}
          <p className="font-heading font-bold text-ink text-xl leading-tight">{shift.location}</p>
          <p className={`text-sm font-semibold mt-1 ${dc.text}`}>{shift.department}</p>
          <p className="text-fog text-xs mt-0.5">{shift.position}</p>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-72 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${dc.glow}, transparent)` }}
      />
    </div>
  );
}

function BulletinItem({ a }) {
  const [open, setOpen] = useState(false);
  const isHigh = a.priority === 'high';
  const isNew  = a.date >= new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);

  return (
    <div className={`relative rounded-lg overflow-hidden transition-colors
      ${isHigh
        ? 'bg-red-950/30 border border-red-500/20'
        : 'bg-shell/40 border border-rim/40 hover:border-rim/70'
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isHigh ? 'bg-red-400' : 'bg-rim/60'}`} />

      <div className="pl-4 pr-4 py-3">
        {/* Top row: title + badges + date */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`font-heading font-bold text-sm leading-snug ${isHigh ? 'text-red-300' : 'text-ink'}`}>
              {a.title}
            </span>
            {isHigh && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-10 font-bold tracking-widest uppercase bg-red-500/15 text-red-400 border border-red-500/25">
                Important
              </span>
            )}
            {isNew && !isHigh && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-10 font-bold tracking-widest uppercase bg-cyan/10 text-cyan border border-cyan/20">
                New
              </span>
            )}
          </div>
          <span className="text-10 text-fog tracking-wide shrink-0 mt-0.5">
            {format(parseISO(a.date), 'MMM d')}
          </span>
        </div>

        {/* Body */}
        <p className={`text-xs leading-relaxed text-fog-hi ${!open && 'line-clamp-2'}`}>
          {a.body}
        </p>

        {/* Footer: read more + author */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-10 text-fog tracking-wide">{a.author}</span>
          {a.body.length > 120 && (
            <button
              onClick={() => setOpen(o => !o)}
              className={`text-10 font-bold tracking-widest uppercase transition-colors
                ${isHigh ? 'text-red-400 hover:text-red-300' : 'text-cyan hover:text-cyan-light'}`}
            >
              {open ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftHeroSkeleton() {
  return (
    <div className="panel p-6 animate-pulse flex gap-8 items-center">
      <div className="flex-1 space-y-3">
        <div className="h-3 w-20 bg-shell rounded" />
        <div className="h-12 w-72 bg-shell rounded" />
        <div className="h-4 w-40 bg-shell rounded" />
      </div>
    </div>
  );
}
