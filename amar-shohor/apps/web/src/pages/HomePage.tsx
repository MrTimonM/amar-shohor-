import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../components/Icon';
import { Card, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { COPY, useUi } from '../lib/ui-context';

/**
 * The front door.
 *
 * Two jobs, in this order. First: say what the map is and let anyone walk
 * straight into it, because reading is free and comes first — the public
 * observer is the primary user and must never be made to sign in. Second: send
 * the two kinds of account-holder to the right door, since a citizen and an
 * authority staffer want opposite things from the same city.
 *
 * The figures below are live from the API rather than written into the page.
 * A landing page quoting numbers the product cannot currently produce is the
 * kind of claim this project exists to argue against.
 */
export function HomePage() {
  const { t } = useUi();
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const stats = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard, staleTime: 60_000 });
  const totals = stats.data?.totals;

  return (
    <div className="home">
      <section className="home-hero">
        <span className="eyebrow">{t(COPY.tagline)}</span>
        <h1>
          {t({
            en: 'Many reports. One problem. Tracked in public until it is fixed.',
            bn: 'অনেক রিপোর্ট। একটি সমস্যা। সমাধান না হওয়া পর্যন্ত সবার চোখের সামনে।',
          })}
        </h1>
        <p className="lede">
          {t({
            en: 'Report a city problem in under a minute. Duplicate reports collapse into one verified problem on a live map, ranked by a score you can check factor by factor, and assigned to the department that owns it.',
            bn: 'এক মিনিটের কমে শহরের সমস্যা জানান। একই সমস্যার একাধিক রিপোর্ট মিলে একটি যাচাইকৃত সমস্যা হয়ে মানচিত্রে ওঠে, যার অগ্রাধিকার আপনি নিজে যাচাই করতে পারেন, এবং দায়িত্ব যায় সংশ্লিষ্ট বিভাগের কাছে।',
          })}
        </p>

        <div className="home-cta">
          <Link to="/map" className="btn primary lg">
            <Icon name="map" size={17} />
            {t({ en: 'Open the live map', bn: 'লাইভ মানচিত্র খুলুন' })}
          </Link>
          <Link to="/report" className="btn ghost lg">
            <Icon name="camera" size={17} />
            {t(COPY.reportCta)}
          </Link>
        </div>

        <p className="tiny muted" style={{ marginTop: 10 }}>
          {t({
            en: 'No account needed to read the map or the dashboard.',
            bn: 'মানচিত্র বা ড্যাশবোর্ড দেখতে কোনো অ্যাকাউন্ট লাগে না।',
          })}
        </p>
      </section>

      {/* Live figures, or honest skeletons — never placeholder numbers. */}
      <section className="home-figures" aria-label={t({ en: 'The record so far', bn: 'এ পর্যন্ত যা আছে' })}>
        <Figure
          value={totals?.issues}
          loading={stats.isLoading}
          label={t({ en: 'Problems on the map', bn: 'মানচিত্রে থাকা সমস্যা' })}
        />
        <Figure
          value={totals?.duplicatesMerged}
          loading={stats.isLoading}
          label={t({ en: 'Duplicate reports merged', bn: 'একত্র করা ডুপ্লিকেট রিপোর্ট' })}
        />
        <Figure
          value={totals?.resolved}
          loading={stats.isLoading}
          label={t({ en: 'Problems resolved', bn: 'সমাধান হওয়া সমস্যা' })}
        />
        <Figure
          value={totals?.citizens}
          loading={stats.isLoading}
          label={t({ en: 'People reporting', bn: 'যাঁরা জানিয়েছেন' })}
        />
      </section>

      {/* The two doors. */}
      <section className="home-doors">
        <h2 className="section-head">
          {user
            ? t({ en: 'Where you were going', bn: 'আপনি যেখানে যাচ্ছিলেন' })
            : t({ en: 'Two ways in', bn: 'প্রবেশের দুটি পথ' })}
        </h2>

        <div className="door-grid">
          <Door
            icon="user"
            title={t({ en: 'A citizen', bn: 'একজন নাগরিক' })}
            body={t({
              en: 'Report what is broken on your street, confirm what your neighbours report, and follow every problem you raised until someone closes it.',
              bn: 'আপনার এলাকার সমস্যা জানান, প্রতিবেশীদের জানানো সমস্যা নিশ্চিত করুন, এবং আপনার তোলা প্রতিটি সমস্যার শেষ পর্যন্ত খোঁজ রাখুন।',
            })}
            points={[
              t({ en: 'Photo, location, category — about a minute', bn: 'ছবি, অবস্থান, ধরন — প্রায় এক মিনিট' }),
              t({ en: 'Works offline; the report sends itself later', bn: 'অফলাইনেও চলে; রিপোর্ট পরে নিজেই চলে যায়' }),
              t({ en: 'Your reports stay yours to follow', bn: 'আপনার রিপোর্ট আপনিই অনুসরণ করবেন' }),
            ]}
            action={
              user && !isStaff
                ? { to: '/mine', label: t(COPY.navMine) }
                : user
                  ? { to: '/map', label: t({ en: 'Go to the map', bn: 'মানচিত্রে যান' }) }
                  : { to: '/signin?mode=signup&as=citizen', label: t({ en: 'Create a citizen account', bn: 'নাগরিক অ্যাকাউন্ট খুলুন' }) }
            }
            note={
              user
                ? undefined
                : t({
                    en: 'Anyone can create one, and it takes about thirty seconds.',
                    bn: 'যে কেউ খুলতে পারেন, প্রায় ত্রিশ সেকেন্ড লাগে।',
                  })
            }
          />

          <Door
            icon="shield"
            title={t({ en: 'City authority', bn: 'সিটি কর্তৃপক্ষ' })}
            body={t({
              en: 'Work your department’s queue in priority order, assign it, watch the SLA clock, and close it with a note, and a photograph of the fix when you have one.',
              bn: 'অগ্রাধিকার অনুযায়ী আপনার বিভাগের তালিকা সামলান, দায়িত্ব দিন, সময়সীমা দেখুন, এবং নোট ও সম্ভব হলে সমাধানের ছবিসহ সমস্যাটি বন্ধ করুন।',
            })}
            points={[
              t({ en: 'Triage sorted by an explainable score', bn: 'ব্যাখ্যাযোগ্য স্কোর অনুযায়ী সাজানো তালিকা' }),
              t({ en: 'Merge review where dedup was unsure', bn: 'যেখানে একত্রীকরণ নিশ্চিত নয়, সেখানে যাচাই' }),
              t({ en: 'Attach a proof-of-fix photo when you close it', bn: 'বন্ধ করার সময় সমাধানের ছবি যোগ করুন' }),
            ]}
            action={
              isStaff
                ? { to: '/queue', label: t(COPY.navQueue) }
                : { to: '/signin?as=authority', label: t({ en: 'Authority sign-in', bn: 'কর্তৃপক্ষের সাইন ইন' }) }
            }
            note={
              user
                ? undefined
                : t({
                    en: 'Staff accounts need a code from your city. They are not self-service.',
                    bn: 'স্টাফ অ্যাকাউন্টের জন্য সিটি কর্পোরেশনের কোড লাগে। এটি নিজে নেওয়া যায় না।',
                  })
            }
          />
        </div>

        {!user && (
          <p className="tiny muted center" style={{ marginTop: 14 }}>
            {t({ en: 'Already have an account?', bn: 'আগে থেকেই অ্যাকাউন্ট আছে?' })}{' '}
            <button type="button" className="btn link" onClick={() => navigate('/signin')}>
              {t(COPY.signIn)}
            </button>
          </p>
        )}
      </section>

      {/* What the product actually claims, each stated as a mechanism. */}
      <section className="home-how">
        <h2 className="section-head">{t({ en: 'How it holds together', bn: 'এটি যেভাবে কাজ করে' })}</h2>
        <div className="how-grid">
          <How
            icon="merge"
            title={t({ en: 'Duplicates collapse', bn: 'ডুপ্লিকেট এক হয়ে যায়' })}
            body={t({
              en: 'Distance, category, time, photo similarity and wording are scored together. Confident matches merge; uncertain ones wait for a person, because a wrong merge hides a real problem.',
              bn: 'দূরত্ব, ধরন, সময়, ছবির মিল ও বর্ণনা একসাথে বিচার করা হয়। নিশ্চিত হলে মিলে যায়; সন্দেহ থাকলে মানুষের যাচাইয়ের অপেক্ষা করে — কারণ ভুল একত্রীকরণ আসল সমস্যাকে ঢেকে দেয়।',
            })}
          />
          <How
            icon="chart"
            title={t({ en: 'The rank shows its work', bn: 'অগ্রাধিকার নিজের হিসাব দেখায়' })}
            body={t({
              en: 'Five factors — severity, how many reported it, how many people it affects, how long it has been open, and whether it can injure someone. Every problem page shows what each one contributed.',
              bn: 'পাঁচটি বিষয় — কতটা গুরুতর, কতজন জানিয়েছেন, কতজন ক্ষতিগ্রস্ত, কত দিন ধরে খোলা, এবং এতে কেউ আহত হতে পারে কি না। প্রতিটি সমস্যার পাতায় কোনটি কত যোগ করল তা দেখানো হয়।',
            })}
          />
          <How
            icon="flag"
            title={t({ en: 'Nothing closes quietly', bn: 'কিছুই চুপচাপ বন্ধ হয় না' })}
            body={t({
              en: 'Every status change is a timestamped public event that cannot be edited afterwards, and the person who reported the problem signs off on the fix.',
              bn: 'প্রতিটি অবস্থার পরিবর্তন সময়সহ প্রকাশ্য ঘটনা, যা পরে বদলানো যায় না, এবং সমাধান মেনে নেওয়ার সিদ্ধান্ত দেন যিনি সমস্যাটি জানিয়েছিলেন।',
            })}
          />
        </div>
      </section>
    </div>
  );
}

function Figure({ value, label, loading }: { value?: number; label: string; loading: boolean }) {
  return (
    <Card tight>
      <div className="figure">
        {loading || value === undefined ? (
          <Skeleton height={30} width={72} />
        ) : (
          <span className="figure-value">{value.toLocaleString()}</span>
        )}
        <span className="figure-label">{label}</span>
      </div>
    </Card>
  );
}

function Door({
  icon,
  title,
  body,
  points,
  action,
  note,
}: {
  icon: IconName;
  title: string;
  body: string;
  points: string[];
  action: { to: string; label: string };
  note?: string;
}) {
  return (
    <Card>
      <div className="door">
        <span className="door-mark" aria-hidden="true">
          <Icon name={icon} size={19} />
        </span>
        <h3>{title}</h3>
        <p className="door-body">{body}</p>
        <ul className="door-points">
          {points.map((point) => (
            <li key={point}>
              <Icon name="check" size={14} className="ico" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <Link to={action.to} className="btn primary wide">
          {action.label}
        </Link>
        {note && <p className="tiny muted center door-note">{note}</p>}
      </div>
    </Card>
  );
}

function How({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="how">
      <span className="how-mark" aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
