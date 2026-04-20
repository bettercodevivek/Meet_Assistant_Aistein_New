import { redirect } from 'next/navigation';

/** Legacy URL: knowledge is managed under /dashboard/knowledge-bases (title + system prompt). */
export default function BatchCallingKnowledgeBaseRedirectPage() {
  redirect('/dashboard/knowledge-bases');
}
