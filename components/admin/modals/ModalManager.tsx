'use client'

import { useCreateModal } from '@/contexts/CreationModalsContext'
import CreateOpportunityModal from './CreateOpportunityModal'
import CreateLeadModal from './CreateLeadModal'
import CreateTaskModal from './CreateTaskModal'
import CreateFollowUpModal from './CreateFollowUpModal'

export default function ModalManager() {
  const { activeModal, closeModal } = useCreateModal()

  if (!activeModal) return null

  return (
    <>
      {activeModal === 'opportunity' && <CreateOpportunityModal onClose={closeModal} />}
      {activeModal === 'lead'        && <CreateLeadModal        onClose={closeModal} />}
      {activeModal === 'task'        && <CreateTaskModal        onClose={closeModal} />}
      {activeModal === 'followup'    && <CreateFollowUpModal    onClose={closeModal} />}
    </>
  )
}
