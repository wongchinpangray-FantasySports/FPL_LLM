import { Chat } from "@/components/chat";
import { PageHeader } from "@/components/page-header";

export default function ChatPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        eyebrow="Chat"
        title="FPL analyst"
        description="Live FPL data. Add your Entry ID on Home for squad-specific answers."
      />
      <Chat />
    </div>
  );
}
