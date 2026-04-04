'use client';

import { MessageSquare, Mic, MicOff, PhoneOff, Settings, Subtitles, Video, VideoOff } from 'lucide-react';

function lightenHex(hex: string, pct: number) {
  const n = hex.replace('#', '');
  const num = parseInt(n, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * pct));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * pct));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * pct));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export type MeetSessionMicProps = {
  muted: boolean;
  active: boolean;
  onToggle: () => void;
};

export function MeetSessionControlBar({
  chatOpen,
  onChatToggle,
  captionsOn,
  onCaptionsToggle,
  onSettingsOpen,
  onEndCall,
  mic,
  cameraOn,
  onCameraToggle,
}: {
  chatOpen: boolean;
  onChatToggle: () => void;
  captionsOn: boolean;
  onCaptionsToggle: () => void;
  onSettingsOpen: () => void;
  onEndCall: () => void;
  mic: MeetSessionMicProps;
  cameraOn: boolean;
  onCameraToggle: () => void;
}) {
  const toggleMic = () => {
    if (!mic.active) return;
    mic.onToggle();
  };

  const micOn = !mic.muted && mic.active;
  const micBg = micOn ? '#3C4043' : '#EA4335';
  const micHover = micOn ? lightenHex('#3C4043', 0.1) : lightenHex('#EA4335', 0.1);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-20 items-center justify-center gap-2 px-3 sm:gap-3 md:gap-3">
      <button
        type="button"
        title={mic.muted ? 'Unmute microphone' : 'Mute microphone'}
        aria-label={mic.muted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={micOn}
        style={{ backgroundColor: micBg }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = micHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = micBg;
        }}
        onClick={toggleMic}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-12 sm:w-12"
      >
        {mic.muted ? (
          <MicOff className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
        ) : (
          <Mic className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
        aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
        aria-pressed={cameraOn}
        style={{ backgroundColor: cameraOn ? '#1A73E8' : '#3C4043' }}
        onMouseEnter={(e) => {
          const base = cameraOn ? '#1A73E8' : '#3C4043';
          e.currentTarget.style.backgroundColor = lightenHex(base, 0.1);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = cameraOn ? '#1A73E8' : '#3C4043';
        }}
        onClick={onCameraToggle}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-12 sm:w-12"
      >
        {cameraOn ? (
          <Video className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
        ) : (
          <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        title="Leave call"
        aria-label="Leave call"
        style={{ backgroundColor: '#EA4335' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = lightenHex('#EA4335', 0.1);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#EA4335';
        }}
        onClick={onEndCall}
        className="flex h-10 items-center justify-center rounded-full px-6 text-white transition-colors sm:h-12 sm:px-8"
      >
        <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        title="Transcript"
        aria-label="Toggle transcript"
        aria-pressed={chatOpen}
        style={{
          backgroundColor: chatOpen ? '#8AB4F8' : '#3C4043',
          color: chatOpen ? '#202124' : '#ffffff',
        }}
        onMouseEnter={(e) => {
          const base = chatOpen ? '#8AB4F8' : '#3C4043';
          e.currentTarget.style.backgroundColor = lightenHex(base, 0.1);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = chatOpen ? '#8AB4F8' : '#3C4043';
        }}
        onClick={onChatToggle}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12"
      >
        <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        title="Captions"
        aria-label="Toggle captions"
        aria-pressed={captionsOn}
        style={{ backgroundColor: '#3C4043' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = lightenHex('#3C4043', 0.1);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3C4043';
        }}
        onClick={onCaptionsToggle}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-12 sm:w-12"
      >
        <Subtitles className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        title="Settings"
        aria-label="Meeting settings"
        style={{ backgroundColor: '#3C4043' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = lightenHex('#3C4043', 0.1);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#3C4043';
        }}
        onClick={onSettingsOpen}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors sm:h-12 sm:w-12"
      >
        <Settings className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
      </button>
    </div>
  );
}
