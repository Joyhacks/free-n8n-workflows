// Format alert: turns n8n's error payload into a readable alert.
// Handles both execution errors and trigger errors (which have no execution).
const e = $('On workflow error').first().json;
const ex = e.execution || {};
const err = ex.error || (e.trigger && e.trigger.error) || {};
const workflow = (e.workflow && e.workflow.name) || 'Unknown workflow';
const node = ex.lastNodeExecuted || (err.node && err.node.name) || (e.trigger ? 'trigger' : 'unknown');
const message = String(err.message || err.description || 'No error message').replace(/\s+/g, ' ').slice(0, 500);
const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const mode = ex.mode ? ` (${ex.mode})` : '';
const link = ex.url ? `\n<${ex.url}|Open the failed run>` : '';

return [{
  json: {
    subject: `n8n failure: ${workflow}`,
    slack: `:rotating_light: *${workflow}* failed at *${node}*${mode}\n>${message}${link}`,
    email: `Workflow: ${workflow}\nFailed node: ${node}${mode}\nWhen: ${when}\nError: ${message}\n${ex.url ? `\nOpen the run: ${ex.url}` : '\nThis was a trigger error, so there is no saved run. Open the workflow in n8n to see it.'}`,
  },
}];
