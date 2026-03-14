<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)

// TODO: add max limit
const increment = () => {
  count.value++
}

const decrement = () => {
  count.value--
}

const reset = () => {
  count.value = 0
}
</script>

<template>
  <div class="counter">
    <h2>Counter: {{ count }}</h2>
    <div class="buttons">
      <button @click="decrement">-</button>
      <button @click="reset">Reset</button>
      <button @click="increment">+</button>
    </div>
  </div>
</template>

<style scoped>
.counter {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  text-align: center;
}

.buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}

button {
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
}
</style>