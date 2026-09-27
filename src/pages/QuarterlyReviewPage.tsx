import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { quarterLabel, quarterSpan } from '../domain/dates.ts'
import { GOAL_STATUS_LABEL, goalSymbol } from '../domain/goals.ts'
import type { Quarter, QuarterlyReview, ReviewDecision, StillMatters } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { EmptyNote, InkField, LineList } from '../components/ui.tsx'
import { monthToMarkdown, reviewToMarkdown } from '../domain/markdown.ts'
import { downloadText } from '../lib/download.ts'

function isQuarter(value: number): value is Quarter {
  return value === 1 || value === 2 || value === 3 || value === 4
}

export function QuarterlyReviewPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const year = Number(params.year)
  const quarterNumber = Number(params.quarter)
  const quarter = isQuarter(quarterNumber) ? quarterNumber : null

  useEffect(() => {
    if (quarter && Number.isFinite(year)) journal.ensureReview(year, quarter)
  }, [year, quarter, snapshot.goals.length])

  const review = snapshot.reviews.find((item) => item.year === year && item.quarter === quarter)
  if (!quarter || !review) {
    return (
      <article className="page">
        <div className="page-body">
          <EmptyNote>Opening the review…</EmptyNote>
        </div>
      </article>
    )
  }

  const patch = (recipe: (current: QuarterlyReview) => QuarterlyReview) => journal.updateReview(review.id, recipe)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Quarterly review</p>
          <h1>{quarterLabel(year, quarter)} Review</h1>
          <p className="whisper">{quarterSpan(year, quarter)}</p>
        </div>
      </header>
      <div className="page-body reflection">
        {review.goalReviews.length === 0 && <EmptyNote>This quarter doesn’t have goals yet. They can be added from the goals page.</EmptyNote>}
        {review.goalReviews.map((item) => {
          const goal = snapshot.goals.find((candidate) => candidate.id === item.goalId)
          return (
            <section key={item.goalId} className="goal">
              <header className="goal-head">
                <h2>{goal?.title || 'Goal'}</h2>
                {goal && (
                  <span className="status-btn">
                    {goalSymbol(goal.status)} {GOAL_STATUS_LABEL[goal.status]}
                  </span>
                )}
              </header>
              <InkField label="What did I intend?" value={item.intended} onChange={(intended) => updateReviewField(review, item.goalId, { intended })} />
              <InkField label="What actually happened?" value={item.happened} onChange={(happened) => updateReviewField(review, item.goalId, { happened })} />
              <InkField label="What worked?" value={item.worked} onChange={(worked) => updateReviewField(review, item.goalId, { worked })} />
              <InkField label="What felt difficult?" value={item.difficult} onChange={(difficult) => updateReviewField(review, item.goalId, { difficult })} />
              <InkField label="What did I learn?" value={item.learned} onChange={(learned) => updateReviewField(review, item.goalId, { learned })} />
              <fieldset className="choice-row">
                <legend>Does this still matter?</legend>
                {(['yes', 'unsure', 'no'] as StillMatters[]).map((answer) => (
                  <button key={answer} type="button" className={item.stillMatters === answer ? 'choice on' : 'choice'} onClick={() => updateReviewField(review, item.goalId, { stillMatters: answer })}>
                    {answer}
                  </button>
                ))}
              </fieldset>
              <fieldset className="choice-row">
                <legend>Continue, change, complete, or drop?</legend>
                {(['continue', 'change', 'complete', 'drop'] as ReviewDecision[]).map((decision) => (
                  <button key={decision} type="button" className={item.decision === decision ? 'choice on' : 'choice'} onClick={() => updateReviewField(review, item.goalId, { decision })}>
                    {decision}
                  </button>
                ))}
              </fieldset>
              <InkField label="What is the next meaningful step?" value={item.nextStep} onChange={(nextStep) => updateReviewField(review, item.goalId, { nextStep })} />
              {goal && (
                <p className="whisper">
                  <Link to={`/goals/${goal.year}/${goal.quarter}`}>Back to the goal</Link>
                </p>
              )}
            </section>
          )
        })}
        <section>
          <h2>{quarterLabel(year, quarter)} — big picture</h2>
          <InkField label="I am proud of" value={review.proudOf} onChange={(proudOf) => patch((current) => ({ ...current, proudOf }))} />
          <InkField label="I learned" value={review.learned} onChange={(learned) => patch((current) => ({ ...current, learned }))} />
          <InkField label="I spent too much energy on" value={review.tooMuchEnergyOn} onChange={(tooMuchEnergyOn) => patch((current) => ({ ...current, tooMuchEnergyOn }))} />
          <InkField label="I want more of" value={review.moreOf} onChange={(moreOf) => patch((current) => ({ ...current, moreOf }))} />
          <InkField label="I want less of" value={review.lessOf} onChange={(lessOf) => patch((current) => ({ ...current, lessOf }))} />
          <LineList label="Goals continuing into next quarter" items={review.continuingGoals} onChange={(continuingGoals) => patch((current) => ({ ...current, continuingGoals }))} />
          <LineList label="Goals I am releasing" items={review.releasedGoals} onChange={(releasedGoals) => patch((current) => ({ ...current, releasedGoals }))} />
        </section>
        <p className="page-links">
          <button
            type="button"
            className="quiet-btn"
            onClick={() => downloadText(`q${quarter}-${year}-review.md`, reviewToMarkdown(snapshot, review), 'text/markdown')}
          >
            Export this review
          </button>
          <button
            type="button"
            className="quiet-btn"
            onClick={() => {
              const months = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3]
              const markdown = months.map((month) => monthToMarkdown(snapshot, year, month)).join('\n\n')
              downloadText(`q${quarter}-${year}.md`, markdown, 'text/markdown')
            }}
          >
            Export the quarter’s months
          </button>
        </p>
      </div>
    </article>
  )
}

function updateReviewField(
  review: QuarterlyReview,
  goalId: string,
  patch: Partial<QuarterlyReview['goalReviews'][number]>,
) {
  journal.updateReview(review.id, (current) => ({
    ...current,
    goalReviews: current.goalReviews.map((item) => (item.goalId === goalId ? { ...item, ...patch } : item)),
  }))
}
