'use client'

import { useCreateModal } from '@/contexts/CreationModalsContext'
import CreateOpportunityModal from './CreateOpportunityModal'
import CreateLeadModal from './CreateLeadModal'
import CreateTaskModal from './CreateTaskModal'
import CreateFollowUpModal from './CreateFollowUpModal'
import NewCustomerModal from './NewCustomerModal'

export default function ModalManager() {
  const { activeModal, closeModal } = useCreateModal()

  if (!activeModal) return null

  return (
    <>
      {activeModal === 'customer'    && <NewCustomerModal        onClose={closeModal} />}
      {activeModal === 'opportunity' && <CreateOpportunityModal onClose={closeModal} />}
      {activeModal === 'lead'        && <CreateLeadModal        onClose={closeModal} />}
      {activeModal === 'task'        && <CreateTaskModal        onClose={closeModal} />}
      {activeModal === 'followup'    && <CreateFollowUpModal    onClose={closeModal} />}
    </>
  )
}
