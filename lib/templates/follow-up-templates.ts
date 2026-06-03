export type TemplateChannel = 'sms' | 'email'

export type FollowUpTemplate = {
  id: string
  label: string
  channel: TemplateChannel
  subject?: string
  body: string
}

export const FOLLOW_UP_TEMPLATES: FollowUpTemplate[] = [
  // SMS templates
  {
    id: 'sms_no_pickup_first',
    label: 'No Pick Up — First Contact',
    channel: 'sms',
    body: 'Hi {{customer_first_name}}, this is {{agent_first_name}} from Kratos Moving. I tried reaching you about your move quote. Give me a call or text back when you have a minute! — Kratos Moving',
  },
  {
    id: 'sms_second_text',
    label: 'Second Text — Set Up Time',
    channel: 'sms',
    body: "Hi {{customer_first_name}}, following up on your moving quote. What's a good time today or tomorrow to chat for 5 minutes? — {{agent_first_name}}, Kratos Moving",
  },
  {
    id: 'sms_followup_1',
    label: 'Follow-Up 1: Reminder',
    channel: 'sms',
    body: 'Hi {{customer_first_name}}, just a reminder that we have your quote ready for {{move_date}}. Let me know if you have any questions. — Kratos Moving',
  },
  {
    id: 'sms_followup_2',
    label: 'Follow-Up 2: Emphasize Value',
    channel: 'sms',
    body: "Hi {{customer_first_name}}, Kratos Moving is fully insured, 5-star rated, and ready to handle your move. Happy to walk through anything you're still considering. — Kratos Moving",
  },
  {
    id: 'sms_followup_3',
    label: 'Follow-Up 3: Encourage Action',
    channel: 'sms',
    body: 'Hi {{customer_first_name}}, your quote is still open. To lock it in I just need a quick yes — reply or give us a call. — Kratos Moving',
  },
  {
    id: 'sms_review_request',
    label: 'Review Request',
    channel: 'sms',
    body: 'Hi {{customer_first_name}}, hope your move went smoothly! A quick Google review would mean a lot. Thanks for choosing Kratos Moving.',
  },

  // Email templates
  {
    id: 'email_followup_1',
    label: 'Follow-Up 1: Reminder',
    channel: 'email',
    subject: 'Following up on your Kratos Moving quote',
    body: `Hi {{customer_first_name}},

I wanted to follow up on the moving quote we sent you for {{move_date}}. We're a fully insured, 5-star rated moving company and we'd be glad to take care of your move.

If you have any questions or would like to adjust anything, just reply to this email.

{{agent_first_name}}
Kratos Moving Inc.
{{company_phone}}`,
  },
  {
    id: 'email_followup_2',
    label: 'Follow-Up 2: Emphasize Value',
    channel: 'email',
    subject: 'Why customers choose Kratos Moving',
    body: `Hi {{customer_first_name}},

Just a quick note about your upcoming move on {{move_date}}.

Kratos Moving is:
- Fully insured and licensed
- 5-star rated across hundreds of customer reviews
- Built around clear communication and on-time arrivals

If anything's on your mind about the quote, I'm happy to walk through it with you.

{{agent_first_name}}
Kratos Moving Inc.
{{company_phone}}`,
  },
  {
    id: 'email_followup_3',
    label: 'Follow-Up 3: Encourage Action',
    channel: 'email',
    subject: "Your Kratos Moving quote — let's lock it in",
    body: `Hi {{customer_first_name}},

Your quote for {{move_date}} is still open. To secure your spot, all I need is a quick confirmation — just reply to this email or give us a call.

Looking forward to hearing from you.

{{agent_first_name}}
Kratos Moving Inc.
{{company_phone}}`,
  },
  {
    id: 'email_review_request',
    label: 'Review Request',
    channel: 'email',
    subject: 'How was your move with Kratos?',
    body: `Hi {{customer_first_name}},

Thanks for choosing Kratos Moving. We hope everything went smoothly.

If you have a moment, we'd love it if you could leave us a Google review — it helps other families find us.

Thanks again,
{{agent_first_name}}
Kratos Moving Inc.`,
  },
]

export function getTemplate(id: string): FollowUpTemplate | null {
  return FOLLOW_UP_TEMPLATES.find(t => t.id === id) ?? null
}

export function templatesByChannel(channel: TemplateChannel): FollowUpTemplate[] {
  return FOLLOW_UP_TEMPLATES.filter(t => t.channel === channel)
}
