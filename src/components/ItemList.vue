<script setup lang="ts">
import { ref } from 'vue'

const items = ref<string[]>([])

// Bug: No validation of input
const addItem = (item: string) => {
  items.value.push(item)
}

// Bug: No bounds check
const removeItem = (index: number) => {
  items.value.splice(index, 1)
}
</script>

<template>
  <div class="item-list">
    <h2>Items</h2>
    <ul>
      <li v-for="(item, i) in items" :key="i">
        {{ item }}
        <button @click="removeItem(i)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item-list {
  padding: 20px;
}
</style>
