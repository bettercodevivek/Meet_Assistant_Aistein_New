'use client';

import { MessageSquare, Mic, MicOff, PhoneOff, Settings, Subtitles, Video, VideoOff } from 'lucide-react';

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

  const circleBase =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors sm:h-12 sm:w-12';

  const inactiveCircle = 'bg-[#3C4043] hover:bg-[#4a4d51]';
  const selectedCircle = 'bg-[#8AB4F8] text-[#202124] hover:bg-[#9ec0fa]';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-center px-3 pb-4 pt-2 sm:px-4">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
        {/* Meet-style clustered controls */}
        <div
          className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#2d2e31] px-2 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:gap-2 sm:px-3"
          role="toolbar"
          aria-label="Meeting controls"
        >
          <button
            type="button"
            title={mic.muted ? 'Unmute microphone' : 'Mute microphone'}
            aria-label={mic.muted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={micOn}
            onClick={toggleMic}
            className={`${circleBase} ${micOn ? inactiveCircle : 'bg-[#EA4335] hover:bg-[#f05449]'}`}
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
            onClick={onCameraToggle}
            className={`${circleBase} ${cameraOn ? 'bg-[#1A73E8] hover:bg-[#1967d2]' : inactiveCircle}`}
          >
            {cameraOn ? (
              <Video className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            ) : (
              <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            title="Transcript"
            aria-label="Toggle transcript"
            aria-pressed={chatOpen}
            onClick={onChatToggle}
            className={`${circleBase} ${chatOpen ? selectedCircle : inactiveCircle}`}
          >
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            title="Turn on captions"
            aria-label="Toggle captions"
            aria-pressed={captionsOn}
            onClick={onCaptionsToggle}
            className={`${circleBase} ${captionsOn ? selectedCircle : inactiveCircle}`}
          >
            <Subtitles className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            title="Settings"
            aria-label="Meeting settings"
            onClick={onSettingsOpen}
            className={`${circleBase} ${inactiveCircle}`}
          >
            <Settings className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
          </button>
        </div>

        {/* Prominent leave control — Meet-style red pill */}
        <button
          type="button"
          title="Leave call"
          aria-label="Leave call"
          onClick={onEndCall}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#EA4335] px-5 text-sm font-medium text-white shadow-[0_4px_16px_rgba(234,67,53,0.35)] transition-colors hover:bg-[#f05449] sm:h-12 sm:px-7"
        >
          <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
          <span className="hidden pr-0.5 sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}
