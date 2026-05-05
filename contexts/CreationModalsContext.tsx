'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ModalType = 'opportunity' | 'lead' | 'task' | 'followup' | null

interface ModalContextValue {
  activeModal: ModalType
  openModal: (type: NonNullable<ModalType>) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function CreationModalsProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const openModal = useCallback((type: NonNullable<ModalType>) => setActiveModal(type), [])
  const closeModal = useCallback(() => setActiveModal(null), [])

  return (
    <ModalContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useCreateModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useCreateModal must be used inside CreationModalsProvider')
  return ctx
}
