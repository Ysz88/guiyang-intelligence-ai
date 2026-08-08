import { useMemo, useState } from 'react'
import { Shell, type ViewKey } from './components/Shell'
import { AssessmentView } from './views/AssessmentView'
import { FacilityView } from './views/FacilityView'
import { OverviewView } from './views/OverviewView'
import { RegulatoryView } from './views/RegulatoryView'
import { ResidentsView } from './views/ResidentsView'
import { ReviewView } from './views/ReviewView'
import { useDemoState } from './store/useDemoState'

export default function App() {
  const { state, saveRecord, confirmReview, reset } = useDemoState()
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null)

  const selectedResident = useMemo(
    () => state.residents.find((resident) => resident.id === selectedResidentId) ?? null,
    [selectedResidentId, state.residents],
  )

  const startAssessment = (residentId?: string) => {
    const fallback = state.residents.find((resident) => resident.checkStatus === '待检查')
    setSelectedResidentId(residentId ?? fallback?.id ?? state.residents[0]?.id ?? null)
    setActiveView('assessment')
  }

  let content
  switch (activeView) {
    case 'residents':
      content = (
        <ResidentsView
          residents={state.residents}
          onStartAssessment={startAssessment}
        />
      )
      break
    case 'assessment':
      content = (
        <AssessmentView
          residents={state.residents}
          selectedResident={selectedResident}
          onSelectResident={setSelectedResidentId}
          onSaveRecord={saveRecord}
          onOpenReviews={() => setActiveView('reviews')}
        />
      )
      break
    case 'reviews':
      content = (
        <ReviewView
          residents={state.residents}
          records={state.records}
          onConfirm={confirmReview}
        />
      )
      break
    case 'facility':
      content = <FacilityView residents={state.residents} records={state.records} />
      break
    case 'regulatory':
      content = <RegulatoryView residents={state.residents} records={state.records} />
      break
    default:
      content = (
        <OverviewView
          residents={state.residents}
          records={state.records}
          onNavigate={setActiveView}
          onStartAssessment={startAssessment}
        />
      )
  }

  return (
    <Shell activeView={activeView} onNavigate={setActiveView} onReset={reset}>
      {content}
    </Shell>
  )
}
