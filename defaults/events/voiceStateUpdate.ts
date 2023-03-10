import { Event } from "../../types";

export const event: Event<"voiceStateUpdate"> = {
    event: 'voiceStateUpdate',
    func: (client, logger, oldState, newState) => {
        if (!oldState.channelId && newState.channelId) {
            client.emit('joinedVoiceChannel', newState);
        }
        if (oldState.channelId && !newState.channelId) {
            client.emit('leftVoiceChannel', oldState);
        }
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            client.emit('movedVoiceChannel', oldState, newState);
            client.emit('leftVoiceChannel', oldState);
            client.emit('joinedVoiceChannel', newState);
        }
    }
}