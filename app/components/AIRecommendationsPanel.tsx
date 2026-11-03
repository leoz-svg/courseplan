'use client';

import { demoRecommendations } from '../../lib/demoRecommendations';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Brain,
  MessageSquare,
  Sparkles,
  SendHorizonal,
  BookOpen,
  CalendarClock,
  Star,
  ExternalLink,
  Loader2,
  Wand2,
  Trash2,
} from 'lucide-react';

// ✅ Added: Import course data and storage utilities
import { courses as ALL_COURSES } from '../data/courses';
import { addCourseIdToActivePlan, getActivePlan } from '../../lib/storage';
import { validateCourseAddition, isCourseAlreadyInPlan, getCoursePlanInfo } from '../../lib/validation';
import {
  saveAIChatState,
  getAIChatState,
  addMessageToAIChat,
  updateRecommendationsToAIChat,
  isAIChatStateExpired,
  clearAIChatState,
  RecItem,
  ChatMsg
} from '../../lib/aiChatStorage';

const SUGGESTIONS = [
  "I'm interested in software development and programming",
  "I want to learn about data science and machine learning",
  "I'd like to explore cybersecurity and network management",
  "I'm passionate about web design and user experience",
  "I'm curious about artificial intelligence and robotics",
  "I want to learn about mobile app development",
];

export default function AIRecommendationsPanel() {
  // Restore state from persistent storage
  const [text, setText] = useState('');
  const [items, setItems] = useState<RecItem[]>(() => {
    const saved = getAIChatState();
    return saved.items || [];
  });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(() => {
    const saved = getAIChatState();
    return saved.hasSearched || false;
  });
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const saved = getAIChatState();
    return saved.messages || [];
  });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState<{
    course: RecItem;
    courseData: any;
    validation: any;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableCourses = ALL_COURSES.length;

  // Save state changes to persistent storage
  useEffect(() => {
    saveAIChatState({
      messages,
      items,
      hasSearched
    });
  }, [messages, items, hasSearched]);

  // Check if there's expired chat state
  useEffect(() => {
    if (isAIChatStateExpired()) {
      // If state is expired, we can choose to clear or keep it
      // Here we keep the state but can add expiration notification
      console.log('AI chat state is older than 24 hours');
    }
  }, []);

  const avgMatch = useMemo(() => {
    if (!items.length) return 0;
    const s = items.reduce((acc, it) => acc + (it.match ?? 0), 0);
    return Math.round((s / items.length) * 10) / 10;
  }, [items]);

  const highMatches = useMemo(() => {
    if (!items.length) return 0;
    return items.filter((i) => (i.match ?? 0) >= 85).length;
  }, [items]);

  // ✅ Modified: Actually add course to current plan with constraint validation
  function handleAddToPlan(course: RecItem) {
    try {
      const codeNorm = String(course.course_id).trim().toLowerCase();
      const program = getActivePlan()?.profile.program;
      const found = ALL_COURSES.find(
        (c: any) => String(c.code).trim().toLowerCase() === codeNorm &&
          (!program || c.program === program || c.program === 'All Programs')
      );

      if (!found || typeof found.id !== 'number') {
        setToast(`Cannot add: course code ${course.course_id} not found in catalog`);
        setTimeout(() => setToast(''), 2500);
        return;
      }

      // Check if course is already in plan
      if (isCourseAlreadyInPlan(found.id)) {
        const planInfo = getCoursePlanInfo(found.id);
        setToast(`Course ${course.course_id} is already in your plan (${planInfo.termTitle})`);
        setTimeout(() => setToast(''), 2500);
        return;
      }

      // Validate constraints
      const validation = validateCourseAddition(found);

      if (!validation.isValid) {
        // Show detailed error modal dialog
        setWarningData({
          course,
          courseData: found,
          validation
        });
        setShowWarningModal(true);
        return;
      }

      // If there are warnings, show warning modal dialog
      if (validation.warnings.length > 0) {
        setWarningData({
          course,
          courseData: found,
          validation
        });
        setShowWarningModal(true);
        return;
      }

      // No constraint issues, add directly
      addCourseIdToActivePlan(found.id);
      setToast(`✅ Added ${course.course_id} · ${course.title} to your plan`);
    } catch (e: any) {
      setToast(e?.message || 'Failed to add to plan');
    } finally {
      setTimeout(() => setToast(''), 2500);
    }
  }

  // Confirm adding course (from modal dialog)
  function confirmAddCourse() {
    if (!warningData) return;

    try {
      addCourseIdToActivePlan(warningData.courseData.id);
      setToast(`✅ Added ${warningData.course.course_id} · ${warningData.course.title} to your plan`);
      setShowWarningModal(false);
      setWarningData(null);
    } catch (e: any) {
      setToast(e?.message || 'Failed to add to plan');
    } finally {
      setTimeout(() => setToast(''), 2500);
    }
  }

  const onPickSuggestion = (s: string) => {
    setText(s);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    setItems([]);
    setHasSearched(false);
    setText('');
    clearAIChatState();
    setToast('Chat history cleared');
    setTimeout(() => setToast(''), 2000);
  };

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;

      const now = new Date();
      const ts = now.toTimeString().slice(0, 8);

      const userMsg: ChatMsg = {
        id: `u-${now.getTime()}`,
        role: 'user',
        content: q,
        ts,
      };
      setMessages((prev) => [...prev, userMsg]);
      addMessageToAIChat(userMsg);

      const thinkingMsg: ChatMsg = {
        id: `a-thinking-${now.getTime()}`,
        role: 'assistant',
        variant: 'thinking',
        content: 'Analyzing your interests and finding perfect courses...',
        ts,
      };
      setMessages((prev) => [...prev, thinkingMsg]);

      setError('');
      setLoading(true);
      setItems([]);
      try {
        let data: any;
        if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') {
          data = { source: 'keyword-demo', items: demoRecommendations(q, 6) };
        } else {
          const res = await fetch('/api/recommend', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interest_text: q, topk: 6 }),
          });
          if (!res.ok) throw new Error(`API ${res.status}`);
          data = await res.json();
        }

        const raw: any[] =
          data?.items ?? data?.recommendations ?? data?.recs ?? data?.data ?? [];

        const norm: RecItem[] = raw.map((r: any, idx: number) => ({
          course_id: String(r.course_id ?? r.code ?? r.id ?? `C${idx + 1}`),
          title: String(r.title ?? r.name ?? 'Untitled'),
          match: Math.max(
            0,
            Math.min(
              100,
              Math.round(
                Number(r.match ?? (typeof r.score === 'number' ? r.score * 100 : 60))
              )
            )
          ),
          why: String(r.why ?? r.summary ?? 'Good fit for your interests.'),
          faculty: r.faculty,
          cp:
            typeof r.cp === 'number'
              ? r.cp
              : typeof r.credits === 'number'
                ? r.credits
                : undefined,
          year: r.year ?? r.level,
          skills: Array.isArray(r.skills) ? r.skills : undefined,
          opportunities: Array.isArray(r.opportunities) ? r.opportunities : undefined,
          description:
            typeof r.description === 'string'
              ? r.description
              : typeof r.summary === 'string'
                ? r.summary
                : undefined,
        }));

        setItems(norm);
        updateRecommendationsToAIChat(norm, q);

        const summaryMsg: ChatMsg = {
          id: `a-summary-${Date.now()}`,
          role: 'assistant',
          variant: 'summary',
          content:
            norm.length > 0
              ? `Found ${norm.length} matching courses based on your interests.`
              : `No strong matches found. Try refining your query.`,
          ts,
        };

        setMessages((prev) =>
          prev.map((m): ChatMsg =>
            m.id === thinkingMsg.id ? summaryMsg : m
          )
        );
        addMessageToAIChat(summaryMsg);

        setHasSearched(true);
      } catch (e: any) {
        setError(e?.message || 'Request failed');
        setMessages((prev) =>
          prev.map((m): ChatMsg =>
            m.variant === 'thinking'
              ? {
                id: `a-summary-${Date.now()}`,
                role: 'assistant',
                variant: 'summary',
                content: `Oops, something went wrong. Please try again.`,
                ts: m.ts,
              }
              : m
          )
        );
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    doSearch(text);
    setText('');
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="rounded-2xl border bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-md">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Course Advisor</h1>
            <p className="text-gray-600">
              {process.env.NEXT_PUBLIC_DEMO_MODE === '1' ? '在线演示：关键词匹配（未调用大模型），可尝试 data / programming / web。' : 'Discover courses with local-model recommendations'}
            </p>
          </div>
        </div>
      </div>

      {/* Suggestion + Chat */}
      <div className="rounded-2xl border p-5 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/90 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">AI Course Advisor</h2>
              <p className="text-sm text-gray-500">
                Tell me about your interests and I'll recommend courses
              </p>
            </div>
          </div>

          {/* Clear chat button - only show if there are messages */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* quick suggestions */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPickSuggestion(s)}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-purple-50 hover:text-purple-700 shadow-sm hover:shadow transition text-sm font-medium"
            >
              {s}
            </button>
          ))}
        </div>

        {/* chat history */}
        {messages.length > 0 && (
          <div className="space-y-3 mb-4">
            {messages.map((m) => {
              const me = m.role === 'user';
              return (
                <div key={m.id} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[720px] rounded-2xl px-4 py-3 shadow-sm ${me
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {!me && (
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <div className="w-6 h-6 rounded-md bg-purple-600/90 text-white flex items-center justify-center">
                          <Wand2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">AI Course Advisor</span>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.variant === 'thinking' ? (
                        <span className="inline-flex items-center gap-2 text-gray-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {m.content}
                        </span>
                      ) : (
                        m.content
                      )}
                    </div>

                    <div className={`text-xs mt-2 ${me ? 'text-white/80' : 'text-gray-500'}`}>
                      {m.ts}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* input + send */}
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell me about your interests or career goals..."
            className="flex-1 rounded-xl border px-4 py-3 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50"
          >
            <SendHorizonal className="w-5 h-5" />
            Send
          </button>
        </form>

        {error && <div className="mt-3 text-sm text-red-600">Error: {error}</div>}
      </div>

      {/* Results */}
      {hasSearched && (
        <>
          {/* stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-4">
              <BookOpen className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Available Courses</p>
                <p className="text-2xl font-bold text-gray-900">{availableCourses}</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-4">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Recommendations</p>
                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-4">
              <CalendarClock className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Conversations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {messages.filter((m) => m.role === 'user').length}
                </p>
              </div>
            </div>
          </div>

          {/* recommendations */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {items.map((c, idx) => (
                <div key={c.course_id + idx} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className={`h-2 ${idx % 2 === 0 ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                  <div className="p-5 pb-0 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold tracking-wide text-gray-900">
                          {c.course_id}
                        </span>
                        <span
                          className={`text-xs rounded-full px-2 py-1 font-semibold ${c.match >= 90
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                            }`}
                        >
                          {c.match}% Match
                        </span>
                        <a href="#" className="ml-2 text-gray-400 hover:text-gray-700" title="Open in catalog">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <h4 className="text-xl font-semibold text-gray-900 mt-1">{c.title}</h4>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {c.faculty && (
                          <span className="text-xs rounded-full bg-indigo-50 text-indigo-700 px-2 py-1">
                            {c.faculty}
                          </span>
                        )}
                        {typeof c.cp === 'number' && (
                          <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-1">
                            {c.cp} CP
                          </span>
                        )}
                        {c.year && (
                          <span className="text-xs rounded-full bg-orange-50 text-orange-700 px-2 py-1">
                            {c.year}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {c.description && (
                      <p className="text-gray-700 leading-relaxed mb-4">{c.description}</p>
                    )}

                    <div className="rounded-xl bg-purple-50 p-4 border border-purple-100 mb-4">
                      <div className="flex items-center gap-2 text-purple-800 font-semibold mb-1">
                        <Sparkles className="w-4 h-4" />
                        Why this course?
                      </div>
                      <p className="text-sm text-purple-900/80">{c.why}</p>
                    </div>

                    {c.skills?.length ? (
                      <div className="mb-4">
                        <div className="font-semibold text-gray-900 mb-2">Skills You'll Gain</div>
                        <div className="flex flex-wrap gap-2">
                          {c.skills.slice(0, 6).map((s, i) => (
                            <span
                              key={i}
                              className="text-xs rounded-full px-2 py-1 bg-gray-100 text-gray-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {c.opportunities?.length ? (
                      <div className="mb-5">
                        <div className="font-semibold text-gray-900 mb-2">Career Opportunities</div>
                        <div className="flex flex-wrap gap-2">
                          {c.opportunities.slice(0, 6).map((op, i) => (
                            <span
                              key={i}
                              className="text-xs rounded-full px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100"
                            >
                              {op}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="w-full mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 font-semibold shadow-md hover:shadow-lg transition inline-flex items-center justify-center gap-2"
                      onClick={() => handleAddToPlan(c)}
                    >
                      <span className="text-xl leading-none">＋</span>
                      Add to My Plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 text-white px-4 py-3 shadow-lg">
          {toast}
          <button className="ml-3 text-white/70 hover:text-white" onClick={() => setToast('')}>
            ✕
          </button>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && warningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Course Addition Warning</h3>
                <p className="text-sm text-gray-600">
                  {warningData.validation.isValid ? 'Please review the following warnings' : 'Cannot add this course'}
                </p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900">{warningData.course.course_id}</div>
              <div className="text-sm text-gray-600">{warningData.course.title}</div>
              <div className="text-xs text-gray-500 mt-1">{warningData.courseData.faculty} • {warningData.courseData.credits} CP</div>
            </div>

            {/* Errors */}
            {warningData.validation.errors.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-red-700 mb-2">Issues preventing addition:</div>
                <ul className="space-y-1">
                  {warningData.validation.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {warningData.validation.warnings.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-orange-700 mb-2">Warnings:</div>
                <ul className="space-y-1">
                  {warningData.validation.warnings.map((warning: string, index: number) => (
                    <li key={index} className="text-sm text-orange-600 flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prerequisites info */}
            {warningData.courseData.prerequisites && warningData.courseData.prerequisites.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Prerequisites:</div>
                <div className="text-sm text-gray-600">
                  {warningData.courseData.prerequisites.join(', ')}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setWarningData(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              {warningData.validation.isValid && (
                <button
                  onClick={confirmAddCourse}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Add Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
