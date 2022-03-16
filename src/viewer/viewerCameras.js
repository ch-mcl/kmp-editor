const { GfxScene, GfxCamera, GfxMaterial, GfxModel, GfxNodeRenderer, GfxNodeRendererTransform } = require("../gl/scene.js")
const { ModelBuilder } = require("../util/modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")
const { Mat4 } = require("../math/mat4.js")
const { Geometry } = require("../math/geometry.js")


class ViewerCameras
{
	constructor(window, viewer, data)
	{
		this.window = window
		this.viewer = viewer
		this.data = data
		
		this.scene = new GfxScene()
		this.sceneAfter = new GfxScene()
		
		this.hoveringOverPoint = null
		this.linkingPoints = false
		
		this.modelPoint = new ModelBuilder()
			.addSphere(-150, -150, -150, 150, 150, 150)
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelPointSelection = new ModelBuilder()
			.addSphere(-250, -250, 250, 250, 250, -250)
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelPath = new ModelBuilder()
			.addCylinder(-150, -150, 0, 150, 150, 1000, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelArrow = new ModelBuilder()
			.addCone(-250, -250, 1000, 250, 250, 1300, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelArrowUp = new ModelBuilder()
			.addCone(-150, -150, 600, 150, 150, 1500, 8, new Vec3(0, 0.01, 1).normalize())
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.renderers = []

		this.currentCameraIndex = 0
	}
	
	
	setData(data)
	{
		this.data = data
		this.refresh()
	}
	
	
	destroy()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
	}
	
	
	refreshPanels()
	{
		let panel = this.window.addPanel("Camera", false, (open) => { if (open) this.viewer.setSubviewer(this) })
		this.panel = panel
	
		// panel.addCheckbox(null, "Draw rotation guides", this.viewer.cfg.enableRotationRender, (x) => this.viewer.cfg.enableRotationRender = x)
		panel.addText(null, "<strong>Hold Alt + Click:</strong> Create Object")
		panel.addText(null, "<strong>Hold Alt + Drag Object:</strong> Duplicate Object")
		panel.addText(null, "<strong>Hold Ctrl:</strong> Multiselect")
		panel.addButton(null, "(A) Select/Unselect All", () => this.toggleAllSelection())
		// panel.addButton(null, "(S) Select All With Same ID", () => this.toggleAllSelectionByID())
		panel.addButton(null, "(X) Delete Selected", () => this.deleteSelectedPoints())
		
		let selectedPoints = this.data.cameras.nodes.filter(p => p.selected)

		let selectionGroup = panel.addGroup(null, "Selection:")
		let enabled = (selectedPoints.length > 0)
		let multiedit = (selectedPoints.length > 1)

		let types =
		[
			{ str: "Goal", value: 0 },
			{ str: "FixSearch", value: 1 },
			{ str: "PathSearch", value: 2 },
			{ str: "KartFollow", value: 3 },
			{ str: "KartPathFollow", value: 4 },
			{ str: "OP_FixMoveAt", value: 5 },
			{ str: "OP_PathMoveAt", value: 6 },
			{ str: "MiniGame", value: 7 },
			{ str: "MissionSuccess", value: 8 },
			{ str: "Unknown", value: 9 },
		]
		panel.addSelectionDropdown(selectionGroup, "Type", selectedPoints.map(cam =>  cam.type), types, true, false, (x, i) => { this.window.setNotSaved(); selectedPoints[i].type = x })

		panel.addSelectionNumericInput(selectionGroup,           "X", -1000000, 1000000, selectedPoints.map(cam =>  cam.pos.x),        null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.x = x })
		panel.addSelectionNumericInput(selectionGroup,           "Y", -1000000, 1000000, selectedPoints.map(cam => -cam.pos.z),        null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.z = -x })
		panel.addSelectionNumericInput(selectionGroup,           "Z", -1000000, 1000000, selectedPoints.map(cam => -cam.pos.y),        null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.y = -x })
		panel.addSelectionNumericInput(selectionGroup,      "Rot. X", -1000000, 1000000, selectedPoints.map(cam =>  cam.rotation.x),   null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.x = x })
		panel.addSelectionNumericInput(selectionGroup,      "Rot. Y", -1000000, 1000000, selectedPoints.map(cam =>  cam.rotation.y),   null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.y = x })
		panel.addSelectionNumericInput(selectionGroup,      "Rot. Z", -1000000, 1000000, selectedPoints.map(cam =>  cam.rotation.z),   null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.z = x })
		panel.addSelectionNumericInput(selectionGroup, "ViewStart X", -1000000, 1000000, selectedPoints.map(cam =>  cam.viewStart.x),  null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewStart.x = x })
		panel.addSelectionNumericInput(selectionGroup, "ViewStart Y", -1000000, 1000000, selectedPoints.map(cam =>  -cam.viewStart.z), null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewStart.z = -x })
		panel.addSelectionNumericInput(selectionGroup, "ViewStart Z", -1000000, 1000000, selectedPoints.map(cam =>  -cam.viewStart.y), null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewStart.y = -x })
		panel.addSelectionNumericInput(selectionGroup,   "ViewEnd X", -1000000, 1000000, selectedPoints.map(cam =>  cam.viewEnd.x),    null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewEnd.x = x })
		panel.addSelectionNumericInput(selectionGroup,   "ViewEnd Y", -1000000, 1000000, selectedPoints.map(cam =>  -cam.viewEnd.z),   null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewEnd.z = -x })
		panel.addSelectionNumericInput(selectionGroup,   "ViewEnd Z", -1000000, 1000000, selectedPoints.map(cam =>  -cam.viewEnd.y),   null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewEnd.y = -x })
				
		panel.addSelectionNumericInput(selectionGroup,   "Route", 0, 0xffff, selectedPoints.map(p => p.routeIndex), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].routeIndex = x })
		panel.addSelectionNumericInput(selectionGroup,   "Next Camera", 0, 0xffff, selectedPoints.map(p => p.nextIndex), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].nextIndex = x })

	}
	
	
	refresh()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
		
		for (let point of this.data.cameras.nodes)
		{
			if (point.selected === undefined)
			{
				point.selected = false
				point.moveOrigin = point.pos
			}
			
			point.renderer = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
			
			point.rendererStart = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
			
			point.rendererEnd = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)

			point.rendererSelected = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelPointSelection)
				.setMaterial(this.viewer.materialUnshaded)
				.setEnabled(false)
				
			point.rendererSelectedCore = new GfxNodeRenderer()
				.attach(point.rendererSelected)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
				
			point.rendererDirectionStart = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPath)
				.setMaterial(this.viewer.material)
			
			point.rendererDirectionEnd = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPath)
				.setMaterial(this.viewer.material)
				
			this.renderers.push(point.renderer)
			this.renderers.push(point.rendererStart)
			this.renderers.push(point.rendererEnd)
			this.renderers.push(point.rendererSelected)
			this.renderers.push(point.rendererDirectionStart)
			this.renderers.push(point.rendererDirectionEnd)
		}
		
		this.refreshPanels()
	}
	
	
	getHoveringOverElement(cameraPos, ray, distToHit, includeSelected = true)
	{
		let elem = null
		
		let minDistToCamera = distToHit + 1000
		let minDistToPoint = 1000000
		for (let point of this.data.cameras.nodes)
		{
			if (!includeSelected && point.selected)
				continue
			
			let distToCamera = point.pos.sub(cameraPos).magn()
			if (distToCamera >= minDistToCamera)
				continue
			
			let scale = this.viewer.getElementScale(point.pos)
			
			let pointDistToRay = Geometry.linePointDistance(ray.origin, ray.direction, point.pos)
			
			if (pointDistToRay < 150 * scale * 4 && pointDistToRay < minDistToPoint)
			{
				elem = point
				minDistToCamera = distToCamera
				minDistToPoint = pointDistToRay
			}
		}
		
		return elem
	}
	
	
	selectAll()
	{
		for (let point of this.data.cameras.nodes)
			point.selected = true
		
		this.refreshPanels()
	}
	
	
	unselectAll()
	{
		for (let point of this.data.cameras.nodes)
			point.selected = false
		
		this.refreshPanels()
	}
	
	
	toggleAllSelection()
	{
		let hasSelection = (this.data.cameras.nodes.find(p => p.selected) != null)
		
		if (hasSelection)
			this.unselectAll()
		else
			this.selectAll()
	}
	
	
	toggleAllSelectionByID()
	{
		let selectedObjs = this.data.cameras.nodes.filter(p => p.selected)
		
		for (let point of this.data.cameras.nodes)
		{
			if (selectedObjs.find(p => p.id == point.id) != null)
				point.selected = true
			else
				point.selected = false
		}
		
		this.refreshPanels()
	}
	
	
	deleteSelectedPoints()
	{
		let pointsToDelete = []
		
		for (let point of this.data.cameras.nodes)
		{
			if (!point.selected)
				continue
			
			pointsToDelete.push(point)
		}
		
		for (let point of pointsToDelete)
			this.data.cameras.removeNode(point)
		
		this.refresh()
		this.window.setNotSaved()
		this.window.setUndoPoint()
	}
	
	
	onKeyDown(ev)
	{
		switch (ev.key)
		{
			case "A":
			case "a":
				this.toggleAllSelection()
				return true
			
			case "S":
			case "s":
				this.toggleAllSelectionByID()
				return true
			
			case "Backspace":
			case "Delete":
			case "X":
			case "x":
				this.deleteSelectedPoints()
				return true
		}
		
		return false
	}
	
	
	onMouseDown(ev, x, y, cameraPos, ray, hit, distToHit, mouse3DPos)
	{
		this.linkingPoints = false
		
		for (let point of this.data.cameras.nodes)
			point.moveOrigin = point.pos
		
		let hoveringOverElem = this.getHoveringOverElement(cameraPos, ray, distToHit)
		
		if (ev.altKey || (!ev.ctrlKey && (hoveringOverElem == null || !hoveringOverElem.selected)))
			this.unselectAll()
		
		if (hoveringOverElem != null)
		{
			if (ev.altKey)
			{
				let newPoint = this.data.cameras.addNode()
				newPoint.Geometry

				newPoint.pos = hoveringOverElem.pos.clone()
				newPoint.rotation = hoveringOverElem.rotation.clone()
				newPoint.viewStart = hoveringOverElem.viewStart.clone()
				newPoint.viewEnd = hoveringOverElem.viewEnd.clone()
				newPoint.type = hoveringOverElem.type
				newPoint.next = hoveringOverElem.next
				newPoint.shake = hoveringOverElem.shake
				newPoint.routeIndex = hoveringOverElem.routeIndex
				newPoint.pointSpeed = hoveringOverElem.pointSpeed
				newPoint.zoomSpeed = hoveringOverElem.zoomSpeed
				newPoint.viewSpeed = hoveringOverElem.viewSpeed
				newPoint.start = hoveringOverElem.start
				newPoint.movie = hoveringOverElem.movie
				newPoint.zoomStart = zoomStart
				newPoint.zoomEnd = hoveringOverElem.zoomEnd
				newPoint.time = hoveringOverElem.time

				this.refresh()
				
				newPoint.selected = true
				this.viewer.setCursor("-webkit-grabbing")
				this.refreshPanels()
				this.window.setNotSaved()
			}
			else
			{
				hoveringOverElem.selected = true
				this.refreshPanels()
				this.viewer.setCursor("-webkit-grabbing")
			}
		}
		else if (ev.altKey)
		{
			let newPoint = this.data.cameras.addNode()
			newPoint.pos = mouse3DPos
			
			this.refresh()
			newPoint.selected = true
			this.viewer.setCursor("-webkit-grabbing")
			this.refreshPanels()
			this.window.setNotSaved()
		}
	}
	
	
	onMouseMove(ev, x, y, cameraPos, ray, hit, distToHit)
	{
		if (!this.viewer.mouseDown)
		{
			let lastHover = this.hoveringOverPoint
			this.hoveringOverPoint = this.getHoveringOverElement(cameraPos, ray, distToHit)
			
			if (this.hoveringOverPoint != null)
				this.viewer.setCursor("-webkit-grab")
			
			if (this.hoveringOverPoint != lastHover)
				this.viewer.render()
		}
		else
		{
			if (this.viewer.mouseAction == "move")
			{
				let linkToPoint = this.getHoveringOverElement(cameraPos, ray, distToHit, false)
				
				for (let point of this.data.cameras.nodes)
				{
					if (!point.selected)
						continue
					
					this.window.setNotSaved()
					this.viewer.setCursor("-webkit-grabbing")
					
					if (this.linkingPoints && linkToPoint != null)
					{
						point.pos = linkToPoint.pos
					}
					else
					{					
						let screenPosMoved = this.viewer.pointToScreen(point.moveOrigin)
						screenPosMoved.x += this.viewer.mouseMoveOffsetPixels.x
						screenPosMoved.y += this.viewer.mouseMoveOffsetPixels.y
						let pointRayMoved = this.viewer.getScreenRay(screenPosMoved.x, screenPosMoved.y)
						
						let hit = this.viewer.collision.raycast(pointRayMoved.origin, pointRayMoved.direction)
						if (hit != null)
							point.pos = hit.position
						else
						{
							let screenPos = this.viewer.pointToScreen(point.moveOrigin)
							let pointRay = this.viewer.getScreenRay(screenPos.x, screenPos.y)
							let origDistToScreen = point.moveOrigin.sub(pointRay.origin).magn()
							
							point.pos = pointRayMoved.origin.add(pointRayMoved.direction.scale(origDistToScreen))
						}
					}
				}
				
				this.refreshPanels()
			}
		}
	}
	
	
	onMouseUp(ev, x, y)
	{
		
	}
	
	
	drawAfterModel()
	{
		for (let point of this.data.cameras.nodes)
		{
			let scale = (this.hoveringOverPoint == point ? 1.5 : 1) * this.viewer.getElementScale(point.pos)
			
			point.renderer
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0, 0.5, 0, 1])

			point.rendererStart
				.setTranslation(point.viewStart)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.75, 0.25, 0, 1])

			point.rendererEnd
				.setTranslation(point.viewEnd)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.5, 0, 0, 1])

			point.rendererSelected
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([1, 0.5, 1, 1])
				.setEnabled(point.selected)
			
			point.rendererSelectedCore
				.setDiffuseColor([1, 0, 1, 1])
				
			let matrixDirectionStart =
				Mat4.scale(scale, scale / 1.5, scale / 1.5)
				.mul(Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180))
				.mul(Mat4.translation(point.viewStart.x, point.viewStart.y, point.viewStart.z))
				
			point.rendererDirectionStart
				.setCustomMatrix(matrixDirectionStart)
				.setDiffuseColor([0.5, 0.5, 0, 1])
				.setEnabled(true)

			let matrixDirectionEnd =
				Mat4.scale(scale, scale / 1.5, scale / 1.5)
				.mul(Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180))
				.mul(Mat4.translation(point.viewEnd.x, point.viewEnd.y, point.viewEnd.z))

			point.rendererDirectionStart
				.setCustomMatrix(matrixDirectionEnd)
				.setDiffuseColor([1, 0.5, 0, 1])
				.setEnabled(true)

		}
		
		this.scene.render(this.viewer.gl, this.viewer.getCurrentCamera())
		this.sceneAfter.clearDepth(this.viewer.gl)
		this.sceneAfter.render(this.viewer.gl, this.viewer.getCurrentCamera())
	}
}


if (module)
	module.exports = { ViewerCameras }