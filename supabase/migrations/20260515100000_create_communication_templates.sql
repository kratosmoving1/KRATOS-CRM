-- Create communication_templates table

CREATE TABLE IF NOT EXISTS communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'call')),
  trigger text NOT NULL CHECK (trigger IN ('no_answer','voicemail','connected','custom')),
  subject text,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER communication_templates_updated_at
BEFORE UPDATE ON communication_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Insert default templates for No Answer
INSERT INTO communication_templates (name, channel, trigger, subject, body, is_active)
SELECT 'No Answer SMS', 'sms', 'no_answer', NULL,
'Hi {{customer_first_name}}, this is {{agent_name}} from Kratos Moving. I tried reaching you regarding your move. Please call us back at (800) 321-3222 or reply here when you have a moment.', true
WHERE NOT EXISTS (SELECT 1 FROM communication_templates WHERE name = 'No Answer SMS');

INSERT INTO communication_templates (name, channel, trigger, subject, body, is_active)
SELECT 'No Answer Email', 'email', 'no_answer', 'Following up on your move',
'Hi {{customer_first_name}},\n\nI tried reaching you regarding your upcoming move. Please call us back at (800) 321-3222 or reply to this email when you have a moment.\n\nThank you,\n{{agent_name}}\nKratos Moving Inc.', true
WHERE NOT EXISTS (SELECT 1 FROM communication_templates WHERE name = 'No Answer Email');

INSERT INTO communication_templates (name, channel, trigger, subject, body, is_active)
SELECT 'Call Follow-up', 'call', 'no_answer', NULL,
'Follow up after no answer', true
WHERE NOT EXISTS (SELECT 1 FROM communication_templates WHERE name = 'Call Follow-up');
