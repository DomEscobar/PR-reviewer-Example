<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = ref<Todo[]>([])
const newTodo = ref('')
const filter = ref('all')

// Memory leak: interval never cleared
onMounted(() => {
  setInterval(() => {
    console.log('Syncing todos...')
    // This interval runs forever even after component unmounts
  }, 5000)
})

const addTodo = () => {
  if (!newTodo.value.trim()) return
  
  // Issue: using Date.now() as ID can cause collisions
  const todo: Todo = {
    id: Date.now(),
    text: newTodo.value,
    done: false
  }
  
  todos.value.push(todo)
  newTodo.value = ''
}

const toggleTodo = (id: number) => {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    todo.done = !todo.done
  }
}

const deleteTodo = (id: number) => {
  todos.value = todos.value.filter(t => t.id !== id)
}

const clearCompleted = () => {
  todos.value = todos.value.filter(t => !t.done)
}

// Race condition: multiple rapid calls can cause issues
const saveTodos = async () => {
  // No loading state, no error handling
  await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todos.value)
  })
}

const filteredTodos = () => {
  switch (filter.value) {
    case 'active':
      return todos.value.filter(t => !t.done)
    case 'completed':
      return todos.value.filter(t => t.done)
    default:
      return todos.value
  }
}
</script>

<template>
  <div class="todo-list">
    <h2>Todo List</h2>
    
    <div class="add-todo">
      <input
        v-model="newTodo"
        @keyup.enter="addTodo"
        placeholder="What needs to be done?"
      />
      <button @click="addTodo">Add</button>
    </div>
    
    <div class="filters">
      <button @click="filter = 'all'" :class="{ active: filter === 'all' }">All</button>
      <button @click="filter = 'active'" :class="{ active: filter === 'active' }">Active</button>
      <button @click="filter = 'completed'" :class="{ active: filter === 'completed' }">Completed</button>
    </div>
    
    <ul class="todos">
      <li v-for="todo in filteredTodos()" :key="todo.id" :class="{ done: todo.done }">
        <input type="checkbox" :checked="todo.done" @change="toggleTodo(todo.id)" />
        <span>{{ todo.text }}</span>
        <button @click="deleteTodo(todo.id)" class="delete">×</button>
      </li>
    </ul>
    
    <div class="actions">
      <button @click="clearCompleted">Clear Completed</button>
      <button @click="saveTodos">Save</button>
    </div>
  </div>
</template>

<style scoped>
.todo-list {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
}

.add-todo {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.add-todo input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.filters button.active {
  background: #42b883;
  color: white;
}

.todos {
  list-style: none;
  padding: 0;
}

.todos li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.todos li.done span {
  text-decoration: line-through;
  color: #999;
}

.delete {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #ff4444;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>