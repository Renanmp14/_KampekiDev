import React from 'react';
import SimpleCrudPage from '../components/SimpleCrudPage.jsx';
import { tagApi } from '../api/resources.js';

export default function Tag() {
  return (
    <SimpleCrudPage
      title="Tags"
      fieldLabel="Nome da tag"
      fieldKey="TAG"
      api={tagApi}
    />
  );
}
