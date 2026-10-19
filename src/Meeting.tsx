import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
export default function Meeting({
  token,
  url,
  onDisconnect,
  onError,
}: {
  token: string;
  url: string;
  onDisconnect: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="live-meeting" data-lk-theme="default">
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        audio={false}
        video={false}
        onDisconnected={onDisconnect}
        onError={(e) => onError(e.message)}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
