import { FaFileUpload, FaGlobeAsia, FaPrint, FaRandom, FaShieldAlt, FaBalanceScale } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { Button } from "../components/ui";

// Only features that exist today are listed here.
const FEATURES = [
  {
    icon: FaRandom,
    title: "A different question set for every student",
    text: "Questions are generated fresh for each student from your prompt or material, so answers can't simply be shared.",
  },
  {
    icon: FaGlobeAsia,
    title: "English, Urdu, Arabic and Persian",
    text: "Each student chooses their language. Questions are written natively in it, with right-to-left layout where needed.",
  },
  {
    icon: FaFileUpload,
    title: "Start from a prompt or your files",
    text: "Upload PDF, Word, PowerPoint, text or images (scans are read with OCR), or just describe the topic.",
  },
  {
    icon: FaBalanceScale,
    title: "Negative marking",
    text: "Set marks for correct answers and deductions for wrong ones per question block. Unanswered questions score zero.",
  },
  {
    icon: FaPrint,
    title: "Printable papers",
    text: "Download a PDF paper in any supported language with your institute header and an answer key.",
  },
  {
    icon: FaShieldAlt,
    title: "Fair, timed, one attempt",
    text: "Per-question timers enforced by the server, one attempt per student, and answers saved as you go.",
  },
];

function Home() {
  const { user } = useAuthStore();

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">AI assessments</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              Fair, multilingual assessments, generated for every student.
            </h1>
            <p className="mt-4 text-lg text-ink-muted">
              Gradix turns a short prompt or your teaching material into exams with a unique question set per student, in the
              language each student prefers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Button to={dashboardPathForRole(user.role)} size="lg">
                  Go to my dashboard
                </Button>
              ) : (
                <>
                  <Button to="/signup" size="lg">
                    Create a free account
                  </Button>
                  <Button to="/login" size="lg" variant="secondary">
                    Log in
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="features-heading" className="text-2xl font-bold text-ink">
          What you can do
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.title} className="rounded-card bg-surface p-5 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-50 text-primary-600">
                  <Icon aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{f.text}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export default Home;
