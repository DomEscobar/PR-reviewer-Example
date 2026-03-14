<script setup lang="ts">
import { ref } from 'vue'

const username = ref('')
const email = ref('')
const bio = ref('')

// TODO: add validation
const submitProfile = () => {
  // No validation - could submit empty data
  console.log('Submitting:', { username: username.value, email: email.value, bio: bio.value })
  
  // Simulate API call
  fetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ username: username.value, email: email.value })
  })
}

const clearForm = () => {
  username.value = ''
  email.value = ''
  bio.value = ''
}
</script>

<template>
  <div class="user-profile">
    <h2>User Profile</h2>
    
    <form @submit.prevent="submitProfile">
      <div class="form-group">
        <label for="username">Username</label>
        <input 
          id="username"
          v-model="username" 
          type="text" 
          placeholder="Enter username"
        />
      </div>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          id="email"
          v-model="email" 
          type="email" 
          placeholder="Enter email"
        />
      </div>
      
      <div class="form-group">
        <label for="bio">Bio</label>
        <!-- Potential XSS: user input rendered without sanitization -->
        <textarea 
          id="bio"
          v-model="bio" 
          placeholder="Tell us about yourself"
          rows="4"
        ></textarea>
      </div>
      
      <div class="actions">
        <button type="button" @click="clearForm">Clear</button>
        <button type="submit">Save Profile</button>
      </div>
    </form>
    
    <!-- Preview section - renders bio as HTML (XSS risk) -->
    <div class="preview">
      <h3>Preview</h3>
      <p v-html="bio"></p>
    </div>
  </div>
</template>

<style scoped>
.user-profile {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input, textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  cursor: pointer;
}

.preview {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}
</style>