'use client';

import { AppShell } from '@/components/app-shell';
import { ControlPlane } from '@/components/control-plane';
import { OperationPlane } from '@/components/operation-plane';
import { useChatClient } from '@/components/use-chat-client';

export default function ChatClient(): React.JSX.Element {
  const chat = useChatClient();

  return (
    <AppShell
      control={
        <ControlPlane
          useRemoteAgent={chat.useRemoteAgent}
          demoMode={chat.demoMode}
          modeError={chat.modeError}
          loading={chat.loading}
          remote={chat.remote}
          selectedAgentName={chat.selectedAgentName}
          showDirectProofControls={chat.showDirectProofControls}
          onChatModeChange={chat.handleChatModeChange}
          onDemoModeChange={chat.handleDemoModeChange}
          onProofAction={chat.onProofAction}
          onAgentSelect={chat.handleAgentSelect}
          authPreset={chat.authPreset}
          probing={chat.probing}
          onAuthPresetChange={chat.setAuthPreset}
          onRunAuthProbe={chat.onRunAuthProbe}
        />
      }
      operation={
        <OperationPlane
          useRemoteAgent={chat.useRemoteAgent}
          selectedAgentId={chat.remote.selectedAgentId}
          demoMode={chat.demoMode}
          message={chat.message}
          reply={chat.reply}
          replyAgentName={chat.replyAgentName}
          replyViaRemote={chat.replyViaRemote}
          replyDemoMode={chat.replyDemoMode}
          replyRouted={chat.replyRouted}
          error={chat.error}
          loading={chat.loading}
          sendDisabled={chat.sendDisabled}
          authProfileBlocksSend={chat.authProfileBlocksSend}
          policyUnavailable={chat.policyUnavailable}
          authTraceInput={chat.authTraceInput}
          onMessageChange={chat.setMessage}
          onSubmit={chat.onSubmit}
        />
      }
    />
  );
}
