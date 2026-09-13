const axios = require('axios');
const FormData = require('form-data');
const form = new FormData();
form.append('meeting_id', '123');
form.append('user_id', '456');
form.append('speaker_name', 'Test');
form.append('target_languages', JSON.stringify(['hi']));
form.append('include_audio', 'true');
form.append('audio', Buffer.from('RIFF'), {filename: 'test.wav', contentType: 'audio/wav'});

axios.post('https://2419-35-197-74-182.ngrok-free.app/api/process-audio', form, {
    headers: { ...form.getHeaders(), 'ngrok-skip-browser-warning': 'true' },
    timeout: 10000
}).then(r => console.log('SUCCESS:', r.status))
  .catch(e => console.error('FAILED:', e.message));
