import '../components/panel/panel.css';

import { getSavedPanelView, getSavedTone, savePanelView, saveTone } from '../core/storage';
import { createSidePanelController } from './sidepanel/controller';
import { sendRuntimeMessage } from './sidepanel/runtime-message-bus';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Draftlet side panel root was not found.');
}

const controller = createSidePanelController({
  root,
  storage: {
    getSavedTone,
    getSavedPanelView,
    saveTone,
    savePanelView,
  },
  sendMessage: sendRuntimeMessage,
});

void controller.initialize();

browser.runtime.onMessage.addListener((message) => {
  controller.onMessage(message);
  return undefined;
});
