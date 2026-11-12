document.addEventListener('DOMContentLoaded', () => {
  const prompt = document.getElementById('copilotPrompt');
  document.querySelectorAll('[data-ai-prompt]').forEach(button => button.addEventListener('click', () => {
    if (!prompt) return;
    prompt.value = button.dataset.aiPrompt;
    prompt.focus();
  }));
  document.getElementById('aiCopilotNav')?.addEventListener('click', () => {
    window.setTimeout(() => {
      document.getElementById('copilotPanel')?.scrollIntoView({behavior:'smooth', block:'start'});
      prompt?.focus({preventScroll:true});
    }, 160);
  });
});
