<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import Counter from './components/Counter.vue'
</script>

<template>
  <div class="app">
    <h1>PR Reviewer Example</h1>
    <HelloWorld />
    <Counter />
  </div>
</template>

<style scoped>
.app {
  text-align: center;
  padding: 20px;
}

h1 {
  color: #42b883;
  margin-bottom: 20px;
}
</style>