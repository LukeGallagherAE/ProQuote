'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils';

interface Job {
  id: string; title: string; status: string; priority: string;
  scheduledAt: string | null;
  customer: { name: string };
  assignee: { name: string } | null;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-400', MEDIUM: 'bg-blue-500', HIGH: 'bg-orange-500', URGENT: 'bg-red-500'
};

export default function SchedulePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setJobs);
  }, []);

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  function jobsOnDay(day: number) {
    return jobs.filter(j => {
      if (!j.scheduledAt) return false;
      const d = new Date(j.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const selectedJobs = selected ? jobsOnDay(selected) : [];

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 text-sm">View and manage scheduled jobs</p>
        </div>
        <Link href="/jobs/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Schedule Job
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button onClick={prev} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={next} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayJobs = day ? jobsOnDay(day) : [];
            const isSelected = day === selected;

            return (
              <div
                key={i}
                onClick={() => day && setSelected(isSelected ? null : day)}
                className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                  day ? (isSelected ? 'bg-blue-50' : 'hover:bg-gray-50') : 'bg-gray-50/50'
                }`}
              >
                {day && (
                  <>
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayJobs.slice(0, 2).map(job => (
                        <div key={job.id} className="flex items-center gap-1 truncate">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[job.priority]}`} />
                          <span className="text-xs text-gray-700 truncate">{job.title}</span>
                        </div>
                      ))}
                      {dayJobs.length > 2 && <p className="text-xs text-gray-400">+{dayJobs.length - 2} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && selectedJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">
            Jobs on {MONTH_NAMES[month]} {selected}, {year}
          </h3>
          <ul className="space-y-3">
            {selectedJobs.map(job => (
              <li key={job.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div>
                  <Link href={`/jobs/${job.id}`} className="font-medium text-blue-600 hover:underline text-sm">{job.title}</Link>
                  <p className="text-xs text-gray-500">
                    {job.customer.name}{job.assignee ? ` · ${job.assignee.name}` : ''}
                  </p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && selectedJobs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-sm text-gray-400">No jobs scheduled on {MONTH_NAMES[month]} {selected}.</p>
          <Link href="/jobs/new" className="text-blue-600 text-sm hover:underline mt-1 inline-block">Schedule a job</Link>
        </div>
      )}
    </div>
  );
}
