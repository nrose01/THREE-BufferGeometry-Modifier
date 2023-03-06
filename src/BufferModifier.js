import * as THREE from 'three';

const epsilon = 100000;
let geometry
let position
let normal
let start = null
let end   = null
let indexMemory = []
let groupIsUpdating = false;

let memory = new THREE.BufferAttribute();
const vecA = new THREE.Vector3();
const vecB = new THREE.Vector3();
const currentPosition = new THREE.Vector3();

export default class BufferModifier{
    constructor(m){
        this.mesh = m;
        geometry = m.geometry;
        position = geometry.getAttribute('position');
        normal = geometry.getAttribute('normal');

        this.planarGroups = groupsArePlanar(geometry);
    }

    setVertex(vertexIndex, x, y, z){
        geometry.attributes.position.needsUpdate = true;

        vecA.fromBufferAttribute(position, vertexIndex);
        vecA.multiplyScalar(epsilon).round().divideScalar(epsilon);

        //move all vertices that exist in the same location as this vertex
        //verify that the vert hasn't already been moved during iterative
        //operations
        for (let i = 0; i < position.count; i ++) {
            vecB.fromBufferAttribute(position, i);
            vecB.multiplyScalar(epsilon).round().divideScalar(epsilon);

            if( vecB.equals(vecA) && !indexMemory.includes(i) ){
                position.setXYZ(i, x, y, z);
                indexMemory.push(i);
            }
        }

        if(groupIsUpdating === false){ 
            indexMemory = [] 
            geometry.computeVertexNormals()
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.normal.needsUpdate = true;

    }

    vertexPosition(vertexIndex){        
        currentPosition.fromBufferAttribute( position, vertexIndex );

        currentPosition.applyMatrix4( this.mesh.matrix );
        
        return currentPosition;
    }

    
    translateVertex(vertexIndex, _normal, displacement){     
        const dVec = _normal.clone().multiplyScalar(displacement)
            .multiplyScalar(epsilon).round().divideScalar(epsilon);

        vecA.fromBufferAttribute( position, vertexIndex );
        vecA.multiplyScalar(epsilon).round().divideScalar(epsilon);
        dVec.add(vecA)

        this.setVertex(vertexIndex, dVec.x, dVec.y, dVec.z);
    }

    translateGroup(group, disp, dir = null){
        groupIsUpdating = true;
        memory = geometry.attributes.position.clone();

        indexMemory = [];

        let _normal;
        const indices = uniqueIndicesInGroup(group);
        const isPlane = this.planarGroups[group];
        
        if(dir !== null && !isPlane){
            this.mesh.translateOnAxis(dir, disp);
        }else{
            indices.forEach((x,n) => {
                (dir === null) ?
                    _normal = new THREE.Vector3().fromBufferAttribute(normal, x).normalize()
                    : _normal = dir.normalize();
                    
                this.translateVertex(x, _normal, disp, group);
            });
        }

        if( volumeCheck(memory) && isPlane ){
            geometry.computeBoundingBox();
            geometry.center();

            this.mesh.translateOnAxis(_normal.clone().negate(), disp/2);
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.normal.needsUpdate = true;
        
        groupIsUpdating = false;
    }

    showVertex(v, color = 0xffaa00){
        const vertex = new THREE.Vector3().fromBufferAttribute(position, v);
            
        scene.addPoint(vertex, color);
    }
}

function uniqueIndicesInGroup(group){
    start = geometry.groups[group].start;
    end = start+geometry.groups[group].count;
    let indices = [];
    console.log(geometry.index);
    if(geometry.index){
        for( let i = start; i < end; i++ ){
            indices.push(geometry.index.getX(i));
        }
    }else{
        for( let i = start; i < end; i++ ){
            indices.push(i);
        }
    }

    indices = Array.from(new Set(indices))

    return indices;
}


function groupsArePlanar(g){
    return g.groups.map(x => {
        start = x.start;
        end = start + x.count;

        let indices = [];
        if(g.index){
            for( let i = start; i < end; i++ ){
                indices.push(g.index.array[i]);
            }
        }else{
            for( let i = start; i < end; i++ ){
                indices.push(i);
            }
        }

        indices = Array.from(new Set(indices))

        const n = g.attributes.normal.array;
        const nVecs = indices.map(i => {
            const index = i*3;
            return new THREE.Vector3(Math.round(n[index]*epsilon)/epsilon, Math.round(n[index + 1]*epsilon)/epsilon, Math.round(n[index + 2]*epsilon)/epsilon);
        });
        
        start = null; end = null; indices = [];

        const test = nVecs[0];
        
        return !nVecs.some(x => !x.equals(test));
    })
}

function volumeCheck(memory){
    if(Math.round(getVolume()*epsilon)/epsilon <= 0){
        geometry.setAttribute('position', memory);
        
        position  = geometry.getAttribute('position');
        
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.normal.needsUpdate = true;

        console.warn('Operation not performed. Resulting volume must be greater than zero')
        return false
    }

    return true
}

function getVolume() { // function pulled from discourse. Posted by user: prisoner849
    if (!geometry.isBufferGeometry) {
      console.log("'geometry' must be an indexed or non-indexed buffer geometry");
      return 0;
    }
    
    var isIndexed = geometry.index !== null;
    let position = geometry.attributes.position;
    let sum = 0;
    let p1 = new THREE.Vector3(),
      p2 = new THREE.Vector3(),
      p3 = new THREE.Vector3();
    if (!isIndexed) {
      let faces = position.count / 3;
      for (let i = 0; i < faces; i++) {
        p1.fromBufferAttribute(position, i * 3 + 0);
        p2.fromBufferAttribute(position, i * 3 + 1);
        p3.fromBufferAttribute(position, i * 3 + 2);
        sum += signedVolumeOfTriangle(p1, p2, p3);
      }
    }
    else {
      let index = geometry.index;
      let faces = index.count / 3;
      for (let i = 0; i < faces; i++){
        p1.fromBufferAttribute(position, index.array[i * 3 + 0]);
        p2.fromBufferAttribute(position, index.array[i * 3 + 1]);
        p3.fromBufferAttribute(position, index.array[i * 3 + 2]);
        sum += signedVolumeOfTriangle(p1, p2, p3);
      }
    }
    return sum;
}

function signedVolumeOfTriangle(p1, p2, p3) { // function pulled from discourse. Posted by user: prisoner849
    return p1.dot(p2.cross(p3)) / 6.0;
}

window.BufferModifier = BufferModifier;