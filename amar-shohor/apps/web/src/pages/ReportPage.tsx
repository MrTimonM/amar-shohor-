import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CATEGORIES, DHAKA_CENTER, SEVERITY_LABELS, type Category } from '@amar/shared';
import { Icon } from '../components/Icon';
import { MapCanvas } from '../components/MapCanvas';
import { Banner, Card, Pill, Toast } from '../components/ui';
import { ApiFailure, api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { distance, num } from '../lib/format';
import { queueReport } from '../lib/offline';
import { COPY, useUi } from '../lib/ui-context';
import { useGeolocation } from '../lib/use-geo';

/**
 * Phase 05 — the sixty-second report.
 *
 * Four taps in the happy path: photo, confirm the pin, category, submit. Two
 * things here are not conveniences but core mechanics:
 *
 *   - Nearby open problems are shown *before* submitting, so the cheapest
 *     deduplication is the one that never creates a second report.
 *   - A failed submit goes to IndexedDB with its photo intact rather than
 *     showing an error and losing the work.
 */
export function ReportPage() {
  const { t, lang, categoryLabel } = useUi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const fileInput = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | ''>('');
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmsIssueId, setConfirmsIssueId] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ask for the fix as soon as the page opens: by now the citizen has chosen
  // to report something, so the prompt has context and gets accepted.
  useEffect(() => {
    if (geo.status === 'idle') geo.locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (geo.fix && !pin) setPin({ lat: geo.fix.lat, lng: geo.fix.lng });
  }, [geo.fix, pin]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const nearbyQuery = useQuery({
    queryKey: ['nearby', pin?.lat, pin?.lng, category],
    queryFn: () => api.nearby(pin!.lat, pin!.lng, category || undefined, 150),
    enabled: Boolean(pin),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error(t({ en: 'Pick what kind of problem this is.', bn: 'সমস্যাটি কী ধরনের তা বেছে নিন।' }));
      if (files.length === 0) throw new Error(t({ en: 'A photo is required — it is what makes the report verifiable.', bn: 'ছবি দিতে হবে — এটাই রিপোর্ট যাচাইযোগ্য করে।' }));
      if (!pin) throw new Error(t({ en: 'Drop the pin on the problem first.', bn: 'আগে সমস্যার জায়গায় পিন বসান।' }));

      try {
        const { photos } = await api.uploadPhotos(files);
        return await api.createReport({
          category,
          severity,
          description: description.trim() || undefined,
          location: { type: 'Point', coordinates: [pin.lng, pin.lat] },
          accuracy: geo.fix?.accuracy,
          photoIds: photos.map((p) => p.id),
          confirmsIssueId,
        });
      } catch (err) {
        // Offline, or the API is unreachable: hold everything locally and let
        // the reconnect watcher send it. Nothing is lost, and the citizen is
        // told the truth about what happened.
        if (err instanceof ApiFailure && (err.code === 'offline' || err.status >= 500)) {
          await queueReport({
            category,
            severity,
            description: description.trim() || undefined,
            lat: pin.lat,
            lng: pin.lng,
            accuracy: geo.fix?.accuracy,
            confirmsIssueId,
            photos: files,
          });
          return { queued: true } as const;
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if ('queued' in result) {
        setToast(t({ en: 'Saved on this device — it will send itself when you are back online', bn: 'এই ডিভাইসে সংরক্ষিত — ইন্টারনেট এলে নিজেই পাঠিয়ে দেবে' }));
        reset();
        return;
      }
      if (result.issue) {
        navigate(`/issue/${result.issue.id}`);
        return;
      }
      setToast(t({ en: 'Report sent. It is being matched against existing problems now.', bn: 'রিপোর্ট পাঠানো হয়েছে। এখন বিদ্যমান সমস্যার সঙ্গে মেলানো হচ্ছে।' }));
      reset();
      navigate('/mine');
    },
    onError: (err) => setError(err instanceof ApiFailure ? err.message : String((err as Error).message ?? err)),
  });

  const reset = () => {
    setFiles([]);
    setCategory('');
    setSeverity(3);
    setDescription('');
    setConfirmsIssueId(undefined);
    setError(null);
  };

  /**
   * The signed-out gate. It used to say a phone number was required, which
   * stopped being true when phone sign-in was removed — the citizen was told
   * to produce something the product no longer asks for and no longer accepts.
   */
  if (!user) {
    return (
      <div className="stack" style={{ gap: 18, maxWidth: 520 }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>{t(COPY.reportCta)}</h1>
          <p>
            {t({
              en: 'Reporting needs an email address, so the problem is attached to a real person and you can be told when it is fixed. Reading the map never does.',
              bn: 'রিপোর্ট করতে একটি ইমেইল ঠিকানা দরকার, যাতে সমস্যাটি একজন প্রকৃত মানুষের সঙ্গে যুক্ত থাকে এবং সমাধান হলে আপনাকে জানানো যায়। মানচিত্র দেখতে কখনও লাগে না।',
            })}
          </p>
        </div>
        <Card title={t({ en: 'What signing in gives you', bn: 'সাইন ইন করলে যা পাবেন' })}>
          <div className="stack">
            <ul className="gate-list">
              <li>
                <Icon name="camera" size={17} />
                {t({ en: 'Report a problem in about a minute.', bn: 'প্রায় এক মিনিটেই একটি সমস্যা জানান।' })}
              </li>
              <li>
                <Icon name="clock" size={17} />
                {t({
                  en: 'Follow it through every stage until it is fixed.',
                  bn: 'সমাধান না হওয়া পর্যন্ত প্রতিটি ধাপে নজর রাখুন।',
                })}
              </li>
              <li>
                <Icon name="check" size={17} />
                {t({
                  en: 'Confirm the fix — or reopen it if the problem is still there.',
                  bn: 'সমাধান নিশ্চিত করুন — সমস্যা থেকে গেলে আবার খুলুন।',
                })}
              </li>
            </ul>
            <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
              <Link className="btn primary" to="/signin">
                {t(COPY.signIn)}
              </Link>
              <Link className="btn ghost" to="/">
                {t({ en: 'Keep reading the map', bn: 'মানচিত্র দেখতে থাকুন' })}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const nearby = nearbyQuery.data?.items ?? [];

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 720 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{t(COPY.reportCta)}</h1>
        <p>
          {t({
            en: 'A photo and a pin is enough. Everything else is optional.',
            bn: 'একটি ছবি আর একটি পিনই যথেষ্ট। বাকি সব ঐচ্ছিক।',
          })}
        </p>
      </div>

      {/* 1 — photo */}
      <Card meta={t({ en: 'Step 1', bn: 'ধাপ ১' })} title={t({ en: 'Photograph the problem', bn: 'সমস্যার ছবি তুলুন' })}>
        <div className="stack">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
          />
          {previews.length === 0 ? (
            <button type="button" className="btn lg wide primary" onClick={() => fileInput.current?.click()}>
              <Icon name="camera" size={20} />
              {t({ en: 'Take a photo', bn: 'ছবি তুলুন' })}
            </button>
          ) : (
            <>
              <div className="photos">
                {previews.map((url, i) => (
                  <div className="photo" key={url}>
                    <img src={url} alt="" />
                    <span className="photo-tag">{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => fileInput.current?.click()}>
                  <Icon name="refresh" size={15} />
                  {t({ en: 'Retake', bn: 'আবার তুলুন' })}
                </button>
                <span className="tiny muted">
                  {t({
                    en: 'The photo is compressed on this device before it is sent.',
                    bn: 'পাঠানোর আগে ছবিটি এই ডিভাইসেই ছোট করা হয়।',
                  })}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* 2 — location */}
      <Card
        meta={t({ en: 'Step 2', bn: 'ধাপ ২' })}
        title={t({ en: 'Check the pin', bn: 'পিন ঠিক আছে কিনা দেখুন' })}
        action={
          <button type="button" className="btn sm ghost" onClick={() => geo.locate()}>
            <Icon name="locate" size={15} />
            {t({ en: 'Re-locate', bn: 'আবার খুঁজুন' })}
          </button>
        }
        tight
      >
        {(geo.error || !pin) && (
          <Banner tone={pin ? 'wait' : 'accent'} icon={pin ? 'alert' : 'pin'}>
            {pin
              ? geo.error
              : t({
                  en: 'Tap the map or drag the pin to mark exactly where the problem is.',
                  bn: 'সমস্যাটি ঠিক কোথায়, তা দেখাতে মানচিত্রে চাপ দিন বা পিনটি টেনে বসান।',
                })}
          </Banner>
        )}
        <div style={{ height: 260, borderRadius: 8, overflow: 'hidden', marginTop: geo.error ? 12 : 0 }}>
          <MapCanvas
            issues={nearby}
            onSelect={() => {}}
            focus={pin ? { lat: pin.lat, lng: pin.lng, zoom: 17 } : undefined}
            /*
             * Always in pick mode. It used to be handed `undefined` until GPS
             * answered, so a citizen who refused the permission prompt — or
             * any desktop browser that blocks it — got a map with no pin to
             * drag and no response to tapping, under a caption telling them to
             * do both, and a submit button that stayed disabled without ever
             * saying why.
             */
            pickMode={{
              lat: pin?.lat ?? DHAKA_CENTER.lat,
              lng: pin?.lng ?? DHAKA_CENTER.lng,
              placed: Boolean(pin),
              onMove: (lat, lng) => setPin({ lat, lng }),
            }}
          />
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {t({
            en: 'Drag the pin or tap the map if GPS put it in the wrong place. Accuracy matters — it is what merges your report with other people’s.',
            bn: 'জিপিএস ভুল জায়গায় বসালে পিন সরান বা মানচিত্রে চাপ দিন। সঠিক জায়গা জরুরি — এতেই আপনার রিপোর্ট অন্যদের সঙ্গে যুক্ত হয়।',
          })}
          {geo.fix?.accuracy !== undefined && ` · ${t({ en: 'GPS accuracy', bn: 'জিপিএস নির্ভুলতা' })} ±${distance(geo.fix.accuracy, lang)}`}
        </p>
      </Card>

      {/* Duplicate warning — before submit, not after */}
      {nearby.length > 0 && (
        <Card
          tint={confirmsIssueId ? 'accent' : 'wait'}
          meta={t({ en: 'Already reported?', bn: 'আগেই জানানো হয়েছে?' })}
          title={t({
            en: `${nearby.length} open problem${nearby.length === 1 ? '' : 's'} within 150 m`,
            bn: `১৫০ মিটারের মধ্যে ${num(nearby.length, 'bn')}টি খোলা সমস্যা`,
          })}
        >
          <div className="stack">
            <p className="small dim">
              {t({
                en: 'If one of these is the problem you are standing next to, confirm it instead. Your photo still gets attached, and the problem climbs the priority list.',
                bn: 'আপনি যে সমস্যার পাশে দাঁড়িয়ে আছেন সেটি এর মধ্যে থাকলে নতুন রিপোর্ট না করে সেটিই নিশ্চিত করুন। আপনার ছবি যুক্ত হবে, আর সমস্যাটি প্রাধান্যে উপরে উঠবে।',
              })}
            </p>
            <div className="stack-tight">
              {nearby.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={`issue-row${confirmsIssueId === issue.id ? ' on' : ''}`}
                  onClick={() => setConfirmsIssueId(confirmsIssueId === issue.id ? undefined : issue.id)}
                >
                  {issue.photos[0] ? <img className="issue-thumb" src={issue.photos[0].thumbUrl} alt="" /> : <div className="issue-thumb" />}
                  <div className="grow stack-tight" style={{ gap: 3 }}>
                    <span className="issue-title truncate">{categoryLabel(issue.category)}</span>
                    <div className="issue-meta">
                      <span className="ref">{issue.ref}</span>
                      <span>{distance(issue.distanceM, lang)}</span>
                    </div>
                  </div>
                  {confirmsIssueId === issue.id && (
                    <Pill tone="accent" icon="check">
                      {t({ en: 'Confirming', bn: 'নিশ্চিত করছি' })}
                    </Pill>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 3 — category and detail */}
      <Card meta={t({ en: 'Step 3', bn: 'ধাপ ৩' })} title={t({ en: 'What kind of problem is it?', bn: 'কী ধরনের সমস্যা?' })}>
        <div className="stack">
          <div className="choices">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className={`choice${category === option ? ' on' : ''}`}
                aria-pressed={category === option}
                onClick={() => setCategory(option)}
              >
                <Icon name={option} size={18} className="ico" />
                {categoryLabel(option)}
              </button>
            ))}
          </div>

          <div className="field">
            <label>{t({ en: 'How bad is it?', bn: 'কতটা খারাপ?' })}</label>
            <div className="scale" role="group">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={severity === level ? 'on' : undefined}
                  aria-pressed={severity === level}
                  onClick={() => setSeverity(level)}
                >
                  {level}
                  <span>{t(SEVERITY_LABELS[level]!)}</span>
                </button>
              ))}
            </div>
            <span className="hint">
              {t({
                en: 'If you are not sure, leave it. The photo is checked and the severity is estimated from it.',
                bn: 'নিশ্চিত না হলে রেখে দিন। ছবি দেখে তীব্রতা অনুমান করা হয়।',
              })}
            </span>
          </div>

          <div className="field">
            <label htmlFor="desc">{t({ en: 'Anything worth adding?', bn: 'আর কিছু বলার আছে?' })}</label>
            <textarea
              id="desc"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder={t({
                en: 'Knee-deep water outside the school gate every time it rains.',
                bn: 'বৃষ্টি হলেই স্কুলের গেটের সামনে হাঁটু-সমান পানি জমে।',
              })}
            />
          </div>
        </div>
      </Card>

      {error && (
        <Banner tone="bad" icon="alert">
          {error}
        </Banner>
      )}

      <button
        type="button"
        className="btn primary lg wide"
        disabled={submit.isPending || !category || files.length === 0 || !pin}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? t(COPY.loading) : confirmsIssueId ? t({ en: 'Confirm this problem', bn: 'এই সমস্যাটি নিশ্চিত করুন' }) : t({ en: 'Send report', bn: 'রিপোর্ট পাঠান' })}
      </button>

      <p className="tiny muted center">
        {t({
          en: 'Your name is shown on the problem page. Your phone number is not.',
          bn: 'সমস্যার পাতায় আপনার নাম দেখানো হয়। ফোন নম্বর নয়।',
        })}
      </p>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
