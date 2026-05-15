import ComingSoon from '@/components/admin/ComingSoon'

export default function TemplatesSettingsPage() {
  return (
    <div>
      <ComingSoon title="Communication Templates" />
      <div className="mt-6 rounded-lg border border-slate-100 bg-white p-4">
        <p className="text-sm text-slate-600">This area will allow administrators to manage communication templates (SMS, Email, Call follow-ups). Run the migration <strong>supabase/migrations/20260515100000_create_communication_templates.sql</strong> to create the templates table. The UI to create, edit and preview templates will be added next.</p>
      </div>
    </div>
  )
}
